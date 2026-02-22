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

/**
 * Tries pdf-parse v2 first; if it returns < 20 chars, falls back to pdfjs-dist
 * which handles custom font encodings/CMap tables far more reliably.
 */
export async function extractTextFromPDF(
  buffer: Buffer
): Promise<{ text: string; quality: PdfQuality }> {
  // ── Attempt 1: pdf-parse v2 (fast, but limited font support) ──
  let text = "";
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const data = await withTimeout(
      parser.getText() as Promise<{ text: string }>,
      TIMEOUTS.RESUME_PARSE_TIMEOUT_MS,
      "PDF parsing (pdf-parse)"
    );
    text = (data.text || "").trim();
  } catch (err) {
    console.warn("[resume-parser] pdf-parse v2 failed, trying fallback:", (err as Error).message);
  }

  if (text.length >= 20) {
    return { text, quality: assessQuality(text) };
  }

  // ── Attempt 2: pdfjs-dist (Mozilla PDF.js — handles virtually all PDFs) ──
  try {
    text = await withTimeout(
      extractWithPdfjs(buffer),
      TIMEOUTS.RESUME_PARSE_TIMEOUT_MS,
      "PDF parsing (pdfjs-dist)"
    );
    if (text.length > 0) {
      return { text, quality: assessQuality(text) };
    }
  } catch (err) {
    console.warn("[resume-parser] pdfjs-dist fallback failed:", (err as Error).message);
  }

  return { text: "", quality: "empty" };
}

async function extractWithPdfjs(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: true,
  }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str: string; hasEOL?: boolean }>;
    let pageText = "";
    for (const item of items) {
      pageText += item.str;
      if (item.hasEOL) pageText += "\n";
    }
    pages.push(pageText.trim());
  }

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
