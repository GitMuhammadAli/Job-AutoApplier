/**
 * Extract text from uploaded PDF resume files using pdf-parse.
 * Falls back gracefully if the file can't be parsed.
 */

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch (error) {
    console.error("PDF parse error:", error);
    return "";
  }
}

/**
 * Extract key skills and technologies from resume text.
 */
export function extractSkillsFromResume(text: string): string[] {
  const lower = text.toLowerCase();
  const skills: string[] = [];

  const techPatterns = [
    "react", "vue.js", "angular", "next.js", "nuxt", "svelte",
    "node.js", "express", "nestjs", "fastify", "koa",
    "typescript", "javascript", "python", "java", "c#", "c++", "go", "rust", "ruby", "php", "swift", "kotlin", "dart",
    "flutter", "react native", "ionic", "electron",
    "aws", "azure", "gcp", "google cloud", "digitalocean", "vercel", "netlify",
    "docker", "kubernetes", "terraform", "ansible", "jenkins", "github actions", "ci/cd",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "dynamodb", "firebase", "supabase",
    "graphql", "rest api", "grpc", "websocket",
    "tailwind", "sass", "styled-components", "css modules",
    "figma", "sketch", "adobe xd",
    "machine learning", "deep learning", "nlp", "computer vision", "tensorflow", "pytorch", "scikit-learn",
    "django", "flask", "spring boot", "laravel", ".net", "rails",
    "git", "linux", "agile", "scrum", "jira",
    "sql", "nosql", "prisma", "sequelize", "mongoose",
  ];

  for (const skill of techPatterns) {
    if (lower.includes(skill)) {
      skills.push(skill);
    }
  }

  return skills;
}
