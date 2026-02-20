export type PdfQuality = "good" | "poor" | "empty";

export async function extractText(
  buffer: Buffer,
  fileType: string
): Promise<{ text: string; quality: PdfQuality }> {
  try {
    if (fileType === "pdf") {
      return await extractTextFromPDF(buffer);
    } else if (fileType === "docx") {
      return await extractTextFromDOCX(buffer);
    } else if (fileType === "txt") {
      const text = buffer.toString("utf-8");
      return { text, quality: assessQuality(text) };
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
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as Record<string, unknown>).default || pdfParseModule;
    const data = await withTimeout(
      (pdfParse as (b: Buffer) => Promise<{ text: string }>)(buffer),
      30000,
      "PDF parsing"
    );
    const text = data.text || "";
    return { text, quality: assessQuality(text) };
  } catch (error) {
    console.error("PDF parse error:", error);
    return { text: "", quality: "empty" };
  }
}

async function extractTextFromDOCX(
  buffer: Buffer
): Promise<{ text: string; quality: PdfQuality }> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || "";
    return { text, quality: assessQuality(text) };
  } catch (error) {
    console.error("DOCX parse error:", error);
    return { text: "", quality: "empty" };
  }
}

function assessQuality(text: string): PdfQuality {
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount < 50) return "empty";

  const printable = text.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
  const printableRatio = text.length > 0 ? printable.length / text.length : 0;
  if (printableRatio < 0.5) return "poor";

  return "good";
}

export { extractSkillsFromContent } from "@/lib/skill-extractor";
