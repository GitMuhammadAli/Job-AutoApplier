import { prisma } from "@/lib/prisma";

interface ReadinessCheck {
  name: string;
  passed: boolean;
  hint?: string;
}

export interface ReadinessResult {
  ready: boolean;
  mode: "MANUAL" | "SEMI_AUTO" | "FULL_AUTO";
  checks: ReadinessCheck[];
  missingCount: number;
}

export async function checkReadiness(userId: string): Promise<ReadinessResult> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const resumeCount = await prisma.resume.count({
    where: { userId, isDeleted: false },
  });

  if (!settings) {
    return {
      ready: false,
      mode: "MANUAL",
      checks: [
        {
          name: "Settings",
          passed: false,
          hint: "Complete onboarding first",
        },
      ],
      missingCount: 1,
    };
  }

  const mode = settings.applicationMode as
    | "MANUAL"
    | "SEMI_AUTO"
    | "FULL_AUTO";
  const checks: ReadinessCheck[] = [];

  // All modes
  checks.push({
    name: "Full name",
    passed: !!settings.fullName,
    hint: "Enter your name in Settings → Personal Info",
  });

  if (mode === "MANUAL") {
    return buildResult(mode, checks);
  }

  // SEMI_AUTO and FULL_AUTO
  checks.push({
    name: "At least 1 resume",
    passed: resumeCount > 0,
    hint: "Upload a resume in the Resumes page",
  });
  checks.push({
    name: "Email provider configured",
    passed: !!settings.smtpUser && !!settings.smtpPass,
    hint: "Set up Gmail or Outlook in Settings → Email Sending Method",
  });
  checks.push({
    name: "Email verified (test sent)",
    passed: !!settings.smtpVerifiedAt,
    hint: "Click 'Send Test Email' in Settings to verify your SMTP",
  });

  if (mode === "SEMI_AUTO") {
    return buildResult(mode, checks);
  }

  // FULL_AUTO
  checks.push({
    name: "Keywords set",
    passed: (settings.keywords ?? []).length > 0,
    hint: "Add job search keywords in Settings → Job Preferences",
  });
  checks.push({
    name: "Categories selected",
    passed: (settings.preferredCategories ?? []).length > 0,
    hint: "Select job categories in Settings → Categories",
  });
  checks.push({
    name: "Auto-apply enabled",
    passed: !!settings.autoApplyEnabled,
    hint: "Enable auto-apply in Settings → Speed Settings",
  });
  checks.push({
    name: "Minimum match score set",
    passed: (settings.minMatchScoreForAutoApply || 0) >= 30,
    hint: "Set minimum score (recommended: 70-85) in Settings",
  });

  return buildResult(mode, checks);
}

function buildResult(
  mode: "MANUAL" | "SEMI_AUTO" | "FULL_AUTO",
  checks: ReadinessCheck[]
): ReadinessResult {
  const missingCount = checks.filter((c) => !c.passed).length;
  return {
    ready: missingCount === 0,
    mode,
    checks,
    missingCount,
  };
}

/** Backward-compatible wrapper */
export async function checkAutoApplyReadiness(
  userId: string
): Promise<{ ready: boolean; missing: string[] }> {
  const result = await checkReadiness(userId);
  return {
    ready: result.ready,
    missing: result.checks.filter((c) => !c.passed).map((c) => c.name),
  };
}
