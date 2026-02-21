/**
 * Auth & User Data Test — JobPilot
 *
 * Validates user, accounts, sessions, settings, and resumes for pipeline readiness.
 *
 * Run:  npx tsx src/scripts/test-auth-flow.ts <userId>
 *
 * Requires: DATABASE_URL, ENCRYPTION_KEY (if smtpPass is encrypted)
 */

import "./test-utils";
import { prisma } from "@/lib/prisma";
import {
  header,
  subheader,
  verdict,
  pass,
  fail,
  warn,
  info,
  timer,
  getUserId,
  mask,
  TestResult,
  summarize,
} from "./test-utils";
import { isEncrypted, decryptField } from "@/lib/encryption";
import { extractSkillsFromContent } from "@/lib/skill-extractor";

async function main() {
  const userId = getUserId();
  const results: TestResult[] = [];
  const issues: string[] = [];

  try {
    header("AUTH & USER TEST — JobPilot");
    info(`User ID: ${userId}`);
    console.log("");

    // ── 1. User lookup ──
    subheader("1. User");
    const userTimer = timer();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { accounts: true, sessions: true },
    });

    if (!user) {
      fail(`User not found: ${userId}`);
      results.push({ name: "User", status: "fail", issues: ["User not found"], duration: userTimer() });
    } else {
      pass(`Found: ${user.name ?? "(no name)"} <${user.email ?? "(no email)"}>`);
      pass(`Accounts: ${user.accounts.length}`);
      pass(`Sessions: ${user.sessions.length}`);
      const userIssues: string[] = [];
      if (user.accounts.length === 0) userIssues.push("No OAuth/credentials linked");
      if (user.sessions.length === 0) warn("No active sessions");
      results.push({
        name: "User",
        status: userIssues.length > 0 ? "warn" : "pass",
        issues: userIssues,
        duration: userTimer(),
      });
    }

    if (!user) {
      verdict("VERDICT: User not found — cannot proceed");
      summarize(results);
      return;
    }

    // ── 2. UserSettings ──
    subheader("2. UserSettings");
    const settingsTimer = timer();
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      fail("UserSettings not found");
      results.push({ name: "UserSettings", status: "fail", issues: ["Settings not found"], duration: settingsTimer() });
    } else {
      pass(`Onboarded: ${settings.isOnboarded}`);
      pass(`Application mode: ${settings.applicationMode}`);
      pass(`Application email: ${mask(settings.applicationEmail)}`);
      pass(`Notification email: ${mask(settings.notificationEmail)}`);
      pass(`City: ${settings.city ?? "(not set)"}`);
      pass(`Country: ${settings.country ?? "(not set)"}`);
      pass(`Keywords: ${settings.keywords?.length ?? 0} configured`);

      const settingsIssues: string[] = [];
      if (!settings.isOnboarded) settingsIssues.push("User not onboarded");
      if (!settings.applicationEmail && !settings.notificationEmail) settingsIssues.push("No application/notification email");
      if (!settings.keywords?.length) settingsIssues.push("No keywords configured");

      results.push({
        name: "UserSettings",
        status: settingsIssues.length > 0 ? "warn" : "pass",
        issues: settingsIssues,
        duration: settingsTimer(),
      });
    }

    // ── 3. SMTP / Email Provider ──
    subheader("3. SMTP / Email Provider");
    const smtpTimer = timer();
    const smtpPass = settings?.smtpPass ?? null;
    let smtpPassFormat: "encrypted" | "plain" | "null" = "null";
    if (smtpPass) {
      smtpPassFormat = isEncrypted(smtpPass) ? "encrypted" : "plain";
    }

    info(`smtpPass: ${smtpPass ? mask(smtpPass) : "(not set)"} [${smtpPassFormat}]`);
    if (smtpPassFormat === "plain") warn("smtpPass is stored in plain text — consider encrypting");
    if (smtpPassFormat === "encrypted") pass("smtpPass is encrypted");

    const smtpConfigured =
      settings?.smtpHost && settings?.smtpPort && settings?.smtpUser && settings?.smtpPass;
    const emailProvider = settings?.emailProvider ?? "brevo";

    if (smtpConfigured) {
      pass(`SMTP configured: ${settings!.smtpHost}:${settings!.smtpPort}`);
    } else if (emailProvider === "brevo") {
      info("Using Brevo — SMTP not required");
    } else {
      warn("SMTP not fully configured (host/port/user/pass)");
    }

    const smtpIssues: string[] = [];
    if (smtpPassFormat === "plain") smtpIssues.push("smtpPass stored in plain text");
    if (!smtpConfigured && emailProvider !== "brevo") smtpIssues.push("SMTP incomplete for custom provider");

    results.push({
      name: "SMTP",
      status: smtpIssues.length > 0 ? "warn" : "pass",
      issues: smtpIssues,
      duration: smtpTimer(),
    });

    // ── 4. Resumes ──
    subheader("4. Resumes");
    const resumeTimer = timer();
    const resumes = await prisma.resume.findMany({
      where: { userId, deletedAt: null, isDeleted: false },
    });

    if (resumes.length === 0) {
      fail("No resumes found (deletedAt is null)");
      results.push({ name: "Resumes", status: "fail", issues: ["No resumes"], duration: resumeTimer() });
    } else {
      pass(`Found ${resumes.length} resume(s)`);
      const defaultResume = resumes.find((r) => r.isDefault) ?? resumes[0];

      if (defaultResume) {
        const skillCount = defaultResume.detectedSkills?.length ?? 0;
        const quality = defaultResume.textQuality ?? "unknown";
        pass(`Default resume: "${defaultResume.name}" — ${skillCount} detected skills, quality: ${quality}`);

        // Optionally re-extract skills from content for comparison
        if (defaultResume.content) {
          const extracted = extractSkillsFromContent(defaultResume.content);
          info(`Skill extractor on content: ${extracted.length} skills`);
        }
      }

      const resumeIssues: string[] = [];
      if (!defaultResume?.content) resumeIssues.push("Default resume has no content");
      if ((defaultResume?.detectedSkills?.length ?? 0) === 0) resumeIssues.push("No detected skills on default resume");

      results.push({
        name: "Resumes",
        status: resumeIssues.length > 0 ? "warn" : "pass",
        issues: resumeIssues,
        duration: resumeTimer(),
      });
    }

    // ── 5. Verdict ──
    const hasUser = !!user;
    const hasSettings = !!settings;
    const hasResumes = resumes.length > 0;
    const defaultResume = resumes.find((r) => r.isDefault) ?? resumes[0];
    const hasResumeContent = !!defaultResume?.content;
    const hasEmail = !!(settings?.applicationEmail || settings?.notificationEmail);
    const hasSmtpOrBrevo = smtpConfigured || emailProvider === "brevo";

    const ready =
      hasUser &&
      hasSettings &&
      settings!.isOnboarded &&
      hasEmail &&
      hasResumes &&
      hasResumeContent &&
      (hasSmtpOrBrevo || settings?.applicationMode === "MANUAL");

    verdict(ready ? "VERDICT: Ready for full pipeline" : "VERDICT: Not ready for full pipeline");

    if (ready) {
      pass("User, settings, resumes, and email config are sufficient");
    } else {
      if (!hasUser) fail("User not found");
      if (!hasSettings) fail("UserSettings missing");
      if (hasSettings && !settings!.isOnboarded) fail("User not onboarded");
      if (!hasEmail) fail("No application/notification email");
      if (!hasResumes) fail("No resumes");
      if (!hasResumeContent) fail("Default resume has no content");
      if (!hasSmtpOrBrevo && settings?.applicationMode !== "MANUAL") fail("SMTP/Brevo not configured for automated sending");
    }

    summarize(results);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  ${"\x1b[31m"}❌ Fatal error: ${msg}${"\x1b[0m"}`);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => process.exit(1));
