import { TIMEOUTS } from "./constants";

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

export async function extractTextFromPDF(
  buffer: Buffer
): Promise<{ text: string; quality: PdfQuality }> {
  const timeout = TIMEOUTS.RESUME_PARSE_TIMEOUT_MS;
  let bestText = "";

  // ── Attempt 1: unpdf (serverless-optimized, no canvas/worker deps) ──
  try {
    const text = await withTimeout(extractWithUnpdf(buffer), timeout, "unpdf");
    console.debug(`[resume-parser] unpdf: ${text.length} chars`);
    if (text.length >= 20) {
      return { text, quality: assessQuality(text) };
    }
    if (text.length > bestText.length) bestText = text;
  } catch (err) {
    console.warn("[resume-parser] unpdf failed:", (err as Error).message);
  }

  // ── Attempt 2: pdf-parse v2 (bundles its own pdfjs-dist) ──
  try {
    const text = await withTimeout(extractWithPdfParse(buffer), timeout, "pdf-parse");
    console.debug(`[resume-parser] pdf-parse: ${text.length} chars`);
    if (text.length >= 20) {
      return { text, quality: assessQuality(text) };
    }
    if (text.length > bestText.length) bestText = text;
  } catch (err) {
    console.warn("[resume-parser] pdf-parse failed:", (err as Error).message);
  }

  // ── Attempt 3: pdfjs-dist direct (works locally, may fail on serverless) ──
  try {
    const text = await withTimeout(extractWithPdfjs(buffer), timeout, "pdfjs-dist");
    console.debug(`[resume-parser] pdfjs-dist: ${text.length} chars`);
    if (text.length >= 20) {
      return { text, quality: assessQuality(text) };
    }
    if (text.length > bestText.length) bestText = text;
  } catch (err) {
    console.warn("[resume-parser] pdfjs-dist failed:", (err as Error).message);
  }

  console.warn(`[resume-parser] All methods got <20 chars for ${buffer.length} byte PDF`);
  return { text: bestText, quality: bestText.length > 0 ? "poor" : "empty" };
}

async function extractWithUnpdf(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const uint8 = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(uint8);
  const { text } = await extractText(pdf, { mergePages: true });
  return (text as string).trim();
}

async function extractWithPdfParse(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = typeof result === "string" ? result : (result as { text?: string })?.text ?? "";
    return text.trim();
  } finally {
    try { await (parser as { destroy?: () => Promise<void> }).destroy?.(); } catch { /* ignore */ }
  }
}

async function extractWithPdfjs(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const uint8 = new Uint8Array(buffer);

  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  }

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
    disableAutoFetch: true,
    disableStream: true,
  });

  const doc = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent({
      includeMarkedContent: false,
      disableNormalization: false,
    });
    const items = content.items as Array<{ str: string; hasEOL?: boolean }>;
    let pageText = "";
    for (const item of items) {
      pageText += item.str;
      if (item.hasEOL) pageText += "\n";
    }
    pages.push(pageText.trim());
  }

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
