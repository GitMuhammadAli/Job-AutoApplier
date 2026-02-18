import { prisma } from "@/lib/prisma";

interface JobLike {
  title: string;
  description: string | null;
  skills: string[];
}

interface ResumeRow {
  id: string;
  name: string;
  content: string | null;
  isDefault: boolean;
}

/**
 * Picks the best resume for a given job based on keyword overlap.
 * Falls back to the default resume, then the first available.
 */
export async function pickBestResume(
  userId: string,
  job: JobLike
): Promise<ResumeRow | null> {
  const resumes: ResumeRow[] = await prisma.resume.findMany({
    where: { userId },
    select: { id: true, name: true, content: true, isDefault: true },
  });

  if (resumes.length === 0) return null;
  if (resumes.length === 1) return resumes[0];

  const jobText = `${job.title} ${job.description || ""} ${job.skills.join(" ")}`.toLowerCase();

  let bestResume: ResumeRow | null = null;
  let bestScore = -1;

  for (const resume of resumes) {
    if (!resume.content) continue;
    const words = resume.content.toLowerCase().split(/[\s,;|]+/).filter((w) => w.length > 3);
    let hits = 0;
    for (const word of words.slice(0, 80)) {
      if (jobText.includes(word)) hits++;
    }
    if (hits > bestScore) {
      bestScore = hits;
      bestResume = resume;
    }
  }

  if (bestResume) return bestResume;

  return resumes.find((r) => r.isDefault) || resumes[0];
}
