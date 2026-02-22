import { TIMEOUTS } from "./constants";
import path from "path";
import { pathToFileURL } from "url";

export type PdfQuality = "good" | "poor" | "empty";

export async function extractText(
  buffer: Buffer,
  fileType: string
): Promise<{ text: string; quality: PdfQuality }> {
  try {
    if (fileType === "pdf") {
      return await extractTextFromPDF(buffer);
    }
    return { text: "", quality: "empty" };
  } catch (error) {
    console.error("Text extraction error:", error);
    return { text: "", quality: "empty" };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Two-step PDF text extraction:
 *  1. pdfjs-dist (Mozilla PDF.js) — handles virtually all PDFs including custom fonts
 *  2. pdf-parse v2 — fast fallback
 *
 * pdfjs-dist is tried FIRST because it handles custom font encodings (LaTeX, Canva,
 * design tools) that pdf-parse cannot decode. It requires:
 *  - Worker disabled (server-side, no Web Workers)
 *  - CMap + standard fonts for font decoding
 *  - Listed in next.config.js serverComponentsExternalPackages
 */
export async function extractTextFromPDF(
  buffer: Buffer
): Promise<{ text: string; quality: PdfQuality }> {
  // ── Attempt 1: pdfjs-dist (most reliable for complex PDFs) ──
  let text = "";
  try {
    text = await withTimeout(
      extractWithPdfjs(buffer),
      TIMEOUTS.RESUME_PARSE_TIMEOUT_MS,
      "PDF parsing (pdfjs-dist)"
    );
    console.log(`[resume-parser] pdfjs-dist: got ${text.length} chars`);
    if (text.length >= 20) {
      return { text, quality: assessQuality(text) };
    }
  } catch (err) {
    console.warn("[resume-parser] pdfjs-dist failed:", (err as Error).message);
  }

  // ── Attempt 2: pdf-parse v2 (fast, simpler) ──
  try {
    text = await withTimeout(
      extractWithPdfParse(buffer),
      TIMEOUTS.RESUME_PARSE_TIMEOUT_MS,
      "PDF parsing (pdf-parse)"
    );
    console.log(`[resume-parser] pdf-parse v2: got ${text.length} chars`);
    if (text.length >= 20) {
      return { text, quality: assessQuality(text) };
    }
  } catch (err) {
    console.warn("[resume-parser] pdf-parse v2 failed:", (err as Error).message);
  }

  console.warn(`[resume-parser] All methods returned 0 chars for ${buffer.length} byte PDF`);
  return { text: "", quality: "empty" };
}

async function extractWithPdfParse(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const data = await (parser.getText() as Promise<{ text: string }>);
    return (data.text || "").trim();
  } finally {
    try {
      await (parser as { destroy?: () => Promise<void> }).destroy?.();
    } catch { /* ignore */ }
  }
}

async function extractWithPdfjs(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const uint8 = new Uint8Array(buffer);

  // Resolve worker, CMap, and font paths as file:// URLs (pdfjs-dist v5 requires URL format)
  let workerSrc: string | undefined;
  let cMapUrl: string | undefined;
  let standardFontDataUrl: string | undefined;
  try {
    const pkgPath = require.resolve("pdfjs-dist/package.json");
    const root = path.dirname(pkgPath);
    workerSrc = pathToFileURL(path.join(root, "legacy", "build", "pdf.worker.mjs")).href;
    cMapUrl = pathToFileURL(path.join(root, "cmaps")).href + "/";
    standardFontDataUrl = pathToFileURL(path.join(root, "standard_fonts")).href + "/";
  } catch {
    console.warn("[resume-parser] Could not resolve pdfjs-dist paths");
  }

  if (workerSrc && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
    disableAutoFetch: true,
    disableStream: true,
    ...(cMapUrl ? { cMapUrl, cMapPacked: true } : {}),
    ...(standardFontDataUrl ? { standardFontDataUrl } : {}),
  });

  const doc = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent({
      includeMarkedContent: false,
      disableNormalization: false,
    });
    const items = content.items as Array<{
      str: string;
      hasEOL?: boolean;
      transform?: number[];
    }>;
    let pageText = "";
    for (const item of items) {
      pageText += item.str;
      if (item.hasEOL) pageText += "\n";
    }
    pages.push(pageText.trim());
  }

  // Clean up
  try { await doc.destroy(); } catch { /* ignore */ }

  return pages.filter(Boolean).join("\n\n").trim();
}

function assessQuality(text: string): PdfQuality {
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount < 50) return "empty";

  const printable = text.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
  const printableRatio = text.length > 0 ? printable.length / text.length : 0;
  if (printableRatio < 0.5) return "poor";

  return "good";
}

export { extractSkillsFromContent, parseResume } from "@/lib/skill-extractor";
export type { ParsedResume } from "@/lib/skill-extractor";
