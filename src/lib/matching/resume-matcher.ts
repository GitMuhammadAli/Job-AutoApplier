import { prisma } from "@/lib/prisma";

interface JobLike {
  title: string;
  description: string | null;
  skills: string[];
  category: string | null;
  location: string | null;
}

export interface ResumeRow {
  id: string;
  name: string;
  content: string | null;
  isDefault: boolean;
  fileUrl: string | null;
  fileName: string | null;
  targetCategories: string[];
  detectedSkills: string[];
  updatedAt: Date;
}

export async function pickBestResume(
  userId: string,
  job: JobLike
): Promise<ResumeRow | null> {
  const resumes: ResumeRow[] = await prisma.resume.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      content: true,
      isDefault: true,
      fileUrl: true,
      fileName: true,
      targetCategories: true,
      detectedSkills: true,
      updatedAt: true,
    },
  });

  if (resumes.length === 0) return null;
  if (resumes.length === 1) return resumes[0];

  let candidates = resumes;

  if (job.category) {
    const categoryFiltered = resumes.filter((r) =>
      r.targetCategories.includes(job.category!)
    );
    if (categoryFiltered.length === 1) return categoryFiltered[0];
    if (categoryFiltered.length > 1) candidates = categoryFiltered;
  }

  const jobSkillsArr = Array.from(new Set(
    (job.skills || [])
      .concat(
        `${job.title} ${job.description || ""}`.toLowerCase().match(/\b[\w.#+-]+\b/g) || []
      )
      .map((s) => s.toLowerCase())
  ));

  let bestResume: ResumeRow | null = null;
  let bestScore = -1;

  for (const resume of candidates) {
    const resumeSkillArr = Array.from(new Set([
      ...resume.detectedSkills.map((s) => s.toLowerCase()),
      ...(resume.content || "")
        .toLowerCase()
        .match(/\b[\w.#+-]+\b/g)
        ?.filter((w) => w.length > 2) || [],
    ]));

    let hits = 0;
    for (const js of jobSkillsArr) {
      if (resumeSkillArr.indexOf(js) >= 0) hits++;
      else {
        for (const rs of resumeSkillArr) {
          if (rs.includes(js) || js.includes(rs)) {
            hits++;
            break;
          }
        }
      }
    }

    if (hits > bestScore) {
      bestScore = hits;
      bestResume = resume;
    }
  }

  if (bestResume) {
    const location = (job.location || "").toLowerCase();
    const isGermanJob =
      location.includes("germany") ||
      location.includes("deutschland") ||
      location.includes("german");

    if (isGermanJob) {
      const germanResume = candidates.find((r) => {
        const n = r.name.toLowerCase();
        return n.includes("german") || n.includes("deutsch");
      });
      if (germanResume) return germanResume;
    }

    return bestResume;
  }

  const defaultResume = candidates.find((r) => r.isDefault);
  if (defaultResume) return defaultResume;

  const sorted = [...candidates].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );
  return sorted[0] ?? candidates[0];
}
