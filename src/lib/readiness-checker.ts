import { prisma } from "@/lib/prisma";

export interface CheckAutoApplyReadinessResult {
  ready: boolean;
  missing: string[];
}

export async function checkAutoApplyReadiness(userId: string): Promise<CheckAutoApplyReadinessResult> {
  const missing: string[] = [];

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    return { ready: false, missing: ["User settings not found"] };
  }

  if (!settings.fullName?.trim()) {
    missing.push("fullName");
  }

  if (!settings.applicationEmail?.trim()) {
    missing.push("applicationEmail");
  }

  const hasKeyword = (settings.keywords?.length ?? 0) >= 1;
  if (!hasKeyword) {
    missing.push("keywords");
  }

  const hasCategory = (settings.preferredCategories?.length ?? 0) >= 1;
  if (!hasCategory) {
    missing.push("categories");
  }

  const resumes = await prisma.resume.findMany({
    where: { userId },
    select: { content: true },
  });
  const hasResumeWithContent = resumes.some((r) => (r.content?.length ?? 0) > 50);
  if (!hasResumeWithContent) {
    missing.push("resume");
  }

  const provider = settings.emailProvider || "brevo";
  if (provider === "gmail") {
    if (!settings.smtpPass?.trim()) {
      missing.push("smtpPass");
    }
  } else if (provider === "outlook") {
    if (!settings.smtpPass?.trim()) {
      missing.push("smtpPass");
    }
  } else if (provider === "custom") {
    if (!settings.smtpHost?.trim() || !settings.smtpPass?.trim()) {
      missing.push("smtpHost", "smtpPass");
    }
  }

  return {
    ready: missing.length === 0,
    missing: missing.filter((m, i) => missing.indexOf(m) === i),
  };
}
