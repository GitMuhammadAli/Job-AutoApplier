export type PdfQuality = "good" | "poor" | "empty";

export async function extractTextFromPDF(
  buffer: Buffer
): Promise<{ text: string; quality: PdfQuality }> {
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as Record<string, unknown>).default || pdfParseModule;
    const data = await (pdfParse as (b: Buffer) => Promise<{ text: string }>)(buffer);
    const text = data.text || "";

    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
    if (wordCount < 50) return { text, quality: "empty" };

    const printable = text.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
    const printableRatio = text.length > 0 ? printable.length / text.length : 0;
    if (printableRatio < 0.5) return { text, quality: "poor" };

    return { text, quality: "good" };
  } catch (error) {
    console.error("PDF parse error:", error);
    return { text: "", quality: "empty" };
  }
}

const SKILL_PATTERNS = [
  "react",
  "vue",
  "angular",
  "next.js",
  "node.js",
  "express",
  "nestjs",
  "typescript",
  "javascript",
  "python",
  "java",
  "c#",
  "go",
  "rust",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "flutter",
  "react native",
  "aws",
  "azure",
  "gcp",
  "docker",
  "kubernetes",
  "terraform",
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "elasticsearch",
  "graphql",
  "rest",
  "microservices",
  "ci/cd",
  "git",
  "tailwind",
  "sass",
  "html",
  "css",
  "figma",
  "machine learning",
  "deep learning",
  "nlp",
  "tensorflow",
  "pytorch",
  "django",
  "flask",
  "spring",
  "laravel",
  ".net",
  "sql",
  "linux",
  "nginx",
  "jenkins",
  "ansible",
  "kafka",
  "rabbitmq",
  "prisma",
  "firebase",
  "supabase",
  "vercel",
  "netlify",
];

export function extractSkillsFromContent(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  for (const skill of SKILL_PATTERNS) {
    if (lower.includes(skill)) found.add(skill);
  }

  return Array.from(found);
}
