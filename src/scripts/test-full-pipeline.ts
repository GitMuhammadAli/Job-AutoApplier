/**
 * End-to-end pipeline test — JobPilot
 *
 * Tests the ENTIRE pipeline in one shot: scrape → match → create UserJob →
 * find email → generate email → create DRAFT → simulate send → verify → cleanup.
 *
 * Run:  npx tsx src/scripts/test-full-pipeline.ts <userId>
 *
 * Requires: DATABASE_URL, ENCRYPTION_KEY, GROQ_API_KEY (for email generation)
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
} from "./test-utils";
import {
  computeMatchScore,
  MATCH_THRESHOLDS,
} from "@/lib/matching/score-engine";
import {
  generateApplicationEmail,
  type GenerateEmailInput,
} from "@/lib/ai-email-generator";
import { findCompanyEmail } from "@/lib/email-extractor";
import { decryptSettingsFields } from "@/lib/encryption";
import { canSendNow } from "@/lib/send-limiter";
import { fetchRemotive } from "@/lib/scrapers/remotive";
import { fetchArbeitnow } from "@/lib/scrapers/arbeitnow";
import { pickBestResume } from "@/lib/matching/resume-matcher";
import { categorizeJob } from "@/lib/job-categorizer";

const DRY_RUN = true; // Never actually send emails

interface StepResult {
  step: string;
  status: "pass" | "fail" | "warn";
  message?: string;
}

async function main() {
  const userId = getUserId();

  const stepResults: StepResult[] = [];
  let testUserJobId: string | null = null;
  let testApplicationId: string | null = null;
  let createdGlobalJobId: string | null = null;
  let createdUserJobId: string | null = null;

  try {
    header("FULL PIPELINE TEST — JobPilot");
    info(`User ID: ${userId}`);
    info(`Mode: ${DRY_RUN ? "DRY RUN (no actual send)" : "LIVE"}`);
    console.log("");

    // ─── Load settings early (needed for scrape queries) ──────────────────
    const settingsRaw = await prisma.userSettings.findUnique({
      where: { userId },
    });
    const settings = decryptSettingsFields(settingsRaw);

    // ─── STEP 1: Scrape fresh jobs ─────────────────────────────────────────
    subheader("STEP 1: Scrape fresh jobs");
    const t1 = timer();
    const userKeywords = ((settings?.keywords ?? ["react", "node.js", "javascript"]) as string[]);
    const queries = userKeywords.slice(0, 3).map((kw) => ({
      keyword: kw,
      cities: ["Remote", "Worldwide"],
    }));

    let scrapedJobs = await fetchRemotive(queries);
    let scrapeSource = "remotive";

    if (scrapedJobs.length === 0) {
      info("Remotive returned 0 keyword-filtered jobs, trying unfiltered...");
      scrapedJobs = await fetchRemotive([]);
      scrapeSource = "remotive (unfiltered)";
    }

    if (scrapedJobs.length === 0) {
      info("Remotive empty, falling back to Arbeitnow...");
      scrapedJobs = await fetchArbeitnow();
      scrapeSource = "arbeitnow";
    }

    const t1Elapsed = t1();

    info(`Scraped ${scrapedJobs.length} jobs from ${scrapeSource} in ${t1Elapsed}ms`);
    if (scrapedJobs.length > 0) {
      pass(`Step 1: ${scrapedJobs.length} jobs scraped from ${scrapeSource} in ${t1Elapsed}ms`);
      stepResults.push({ step: "1. Scrape", status: "pass", message: `${scrapedJobs.length} jobs (${scrapeSource})` });
    } else {
      warn("Step 1: No jobs returned from any free source");
      stepResults.push({ step: "1. Scrape", status: "warn", message: "0 jobs" });
    }
    console.log("");

    // ─── STEP 2: Match against user profile ────────────────────────────────
    subheader("STEP 2: Match against user profile");
    const t2 = timer();

    if (!settings) {
      fail("No user settings found");
      stepResults.push({ step: "2. Match", status: "fail", message: "No settings" });
      verdict("VERDICT: Cannot proceed without settings");
      await prisma.$disconnect();
      return;
    }

    const resumes = await prisma.resume.findMany({
      where: { userId, isDeleted: false },
      select: { id: true, name: true, content: true },
    });

    if (resumes.length === 0) {
      fail("No resumes found");
      stepResults.push({ step: "2. Match", status: "fail", message: "No resumes" });
      verdict("VERDICT: Cannot proceed without resumes");
      await prisma.$disconnect();
      return;
    }

    const settingsForMatch = {
      keywords: (settings.keywords ?? []) as string[],
      preferredCategories: (settings.preferredCategories ?? []) as string[],
      preferredPlatforms: (settings.preferredPlatforms ?? []) as string[],
      city: settings.city ?? null,
      country: settings.country ?? null,
      experienceLevel: settings.experienceLevel ?? null,
      workType: (settings.workType ?? []) as string[],
      jobType: (settings.jobType ?? []) as string[],
      salaryMin: settings.salaryMin ?? null,
      salaryMax: settings.salaryMax ?? null,
    };

    const existingUserJobGlobalIds = new Set(
      (
        await prisma.userJob.findMany({
          where: { userId },
          select: { globalJobId: true },
        })
      ).map((j) => j.globalJobId)
    );

    const matchedJobs: Array<{
      job: (typeof scrapedJobs)[0];
      score: number;
      reasons: string[];
      bestResumeId: string | null;
      bestResumeName: string | null;
    }> = [];

    for (const job of scrapedJobs) {
      const jobPayload = {
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        skills: job.skills ?? [],
        category: job.category,
        source: job.source,
        experienceLevel: job.experienceLevel,
        salary: job.salary,
        jobType: job.jobType,
        isFresh: true,
        firstSeenAt: new Date(),
      };

      const result = computeMatchScore(jobPayload, settingsForMatch, resumes);

      if (result.score >= MATCH_THRESHOLDS.SHOW_ON_KANBAN) {
        matchedJobs.push({
          job,
          score: result.score,
          reasons: result.reasons,
          bestResumeId: result.bestResumeId,
          bestResumeName: result.bestResumeName,
        });
      }
    }

    const sortedMatches = matchedJobs.sort((a, b) => b.score - a.score);
    const bestMatch = sortedMatches[0];
    const t2Elapsed = t2();

    info(`Match: ${matchedJobs.length}/${scrapedJobs.length} passed threshold (${MATCH_THRESHOLDS.SHOW_ON_KANBAN}) in ${t2Elapsed}ms`);
    if (bestMatch) {
      pass(`Best match: "${bestMatch.job.title}" @ ${bestMatch.job.company} (score: ${bestMatch.score})`);
      stepResults.push({
        step: "2. Match",
        status: "pass",
        message: `${matchedJobs.length} matched, best: ${bestMatch.score}`,
      });
    } else {
      warn("Step 2: No jobs matched user profile");
      stepResults.push({ step: "2. Match", status: "warn", message: "0 matched" });
    }
    console.log("");

    // ─── STEP 3: Create test UserJob (if matched jobs > 0) ───────────────────
    if (matchedJobs.length === 0) {
      subheader("STEP 3: Create UserJob");
      warn("Skipped — no matched jobs");
      stepResults.push({ step: "3. UserJob", status: "warn", message: "Skipped (no matches)" });
    } else {
      subheader("STEP 3: Create test UserJob");
      const t3 = timer();

      let best: (typeof sortedMatches)[0] | null = null;
      let globalJobId: string | null = null;

      for (const m of sortedMatches) {
        const scrapedJob = m.job;
        const existingGlobal = await prisma.globalJob.findUnique({
          where: {
            sourceId_source: { sourceId: scrapedJob.sourceId, source: scrapedJob.source },
          },
        });
        const gid = existingGlobal?.id ?? null;
        if (gid && existingUserJobGlobalIds.has(gid)) continue;
        best = m;
        if (existingGlobal) {
          globalJobId = existingGlobal.id;
        }
        break;
      }

      if (!best) {
        warn("All matched jobs already have UserJobs — skipping create");
        stepResults.push({ step: "3. UserJob", status: "warn", message: "All already exist" });
      } else {
        const scrapedJob = best.job;

        const platforms = (settings.preferredPlatforms ?? []) as string[];
        const hasRemotive =
          platforms.length === 0 ||
          platforms.some((p) => p.toLowerCase().replace(/\./g, "") === "remotive");
        if (!hasRemotive && platforms.length > 0) {
          warn("User's preferredPlatforms may exclude Remotive");
        }

        if (!globalJobId) {
          const category = scrapedJob.category || categorizeJob(
            scrapedJob.title,
            scrapedJob.skills ?? [],
            scrapedJob.description ?? ""
          );
          const newGlobal = await prisma.globalJob.create({
            data: {
              title: scrapedJob.title,
              company: scrapedJob.company,
              location: scrapedJob.location,
              description: scrapedJob.description,
              salary: scrapedJob.salary,
              jobType: scrapedJob.jobType,
              experienceLevel: scrapedJob.experienceLevel,
              category,
              skills: scrapedJob.skills ?? [],
              postedDate: scrapedJob.postedDate,
              source: scrapedJob.source,
              sourceId: scrapedJob.sourceId,
              sourceUrl: scrapedJob.sourceUrl,
              applyUrl: scrapedJob.applyUrl,
              companyUrl: scrapedJob.companyUrl,
              companyEmail: scrapedJob.companyEmail,
              isActive: true,
              isFresh: true,
            },
          });
          globalJobId = newGlobal.id;
          createdGlobalJobId = newGlobal.id;
          pass(`Created GlobalJob: ${globalJobId}`);
        } else {
          info(`GlobalJob already exists: ${globalJobId}`);
        }

        const userJob = await prisma.userJob.create({
          data: {
            userId,
            globalJobId,
            stage: "SAVED",
            matchScore: best.score,
            matchReasons: best.reasons,
          },
        });
        testUserJobId = userJob.id;
        createdUserJobId = userJob.id;

        pass(`Created UserJob: ${userJob.id}`);
        stepResults.push({ step: "3. UserJob", status: "pass", message: userJob.id });
        info(`Step 3: ${t3()}ms`);
      }
    }
    console.log("");

    // ─── STEP 4: Handle mode (find email, generate, create DRAFT) ───────────
    if (!testUserJobId) {
      subheader("STEP 4: Handle mode");
      warn("Skipped — no UserJob created");
      stepResults.push({ step: "4. Application", status: "warn", message: "Skipped" });
    } else {
      subheader("STEP 4: Handle mode");
      const t4 = timer();

      const userJobWithGlobal = await prisma.userJob.findUnique({
        where: { id: testUserJobId },
        include: { globalJob: true },
      });

      if (!userJobWithGlobal) {
        fail("UserJob not found");
        stepResults.push({ step: "4. Application", status: "fail", message: "UserJob missing" });
      } else {
        const globalJob = userJobWithGlobal.globalJob;
        const applicationMode = (settings!.applicationMode as string) ?? "SEMI_AUTO";

        info(`Application mode: ${applicationMode}`);

        const emailResult = await findCompanyEmail({
          description: globalJob.description,
          company: globalJob.company,
          sourceUrl: globalJob.sourceUrl,
          applyUrl: globalJob.applyUrl,
          companyUrl: globalJob.companyUrl,
        });

        info(`Company email: ${emailResult.email ?? "(none)"} (${emailResult.confidence})`);

        const bestResume = await pickBestResume(userId, globalJob);
        if (!bestResume) {
          fail("No resume for email generation");
          stepResults.push({ step: "4. Application", status: "fail", message: "No resume" });
        } else {
          const user = await prisma.user.findUnique({ where: { id: userId } });
          const senderEmail =
            (settings!.applicationEmail as string) || user?.email || "test@example.com";

          const profile: GenerateEmailInput["profile"] = {
            fullName: (settings!.fullName as string) || user?.name || "Candidate",
            phone: (settings!.phone as string) ?? null,
            experienceLevel: (settings!.experienceLevel as string) ?? null,
            linkedinUrl: (settings!.linkedinUrl as string) ?? null,
            githubUrl: (settings!.githubUrl as string) ?? null,
            portfolioUrl: (settings!.portfolioUrl as string) ?? null,
            includeLinkedin: settings!.includeLinkedin ?? true,
            includeGithub: settings!.includeGithub ?? true,
            includePortfolio: settings!.includePortfolio ?? true,
          };

          const resumeInput: GenerateEmailInput["resume"] = {
            name: bestResume.name,
            content: bestResume.content,
            detectedSkills: (bestResume.detectedSkills ?? []) as string[],
          };

          const settingsInput: GenerateEmailInput["settings"] = {
            preferredTone: (settings!.preferredTone as string) ?? null,
            emailLanguage: (settings!.emailLanguage as string) ?? null,
            customClosing: (settings!.customClosing as string) ?? null,
            customSystemPrompt: (settings!.customSystemPrompt as string) ?? null,
            defaultSignature: (settings!.defaultSignature as string) ?? null,
          };

          const defaultTemplate = await prisma.emailTemplate.findFirst({
            where: { userId, isDefault: true },
          });
          const template: GenerateEmailInput["template"] = defaultTemplate
            ? { subject: defaultTemplate.subject, body: defaultTemplate.body }
            : null;

          const emailContent = await generateApplicationEmail({
            job: {
              title: globalJob.title,
              company: globalJob.company,
              location: globalJob.location,
              salary: globalJob.salary,
              skills: (globalJob.skills ?? []) as string[],
              description: globalJob.description,
              source: globalJob.source,
            },
            profile,
            resume: resumeInput,
            settings: settingsInput,
            template,
          });

          const application = await prisma.jobApplication.create({
            data: {
              userJobId: testUserJobId,
              userId,
              senderEmail,
              recipientEmail: emailResult.email || "hr@example.com",
              subject: emailContent.subject,
              emailBody: emailContent.body,
              resumeId: bestResume.id,
              coverLetter: emailContent.coverLetter,
              status: "DRAFT",
              appliedVia: emailResult.email ? "EMAIL" : "MANUAL",
            },
          });
          testApplicationId = application.id;

          pass(`Created DRAFT application: ${application.id}`);
          info(`Subject: ${emailContent.subject.slice(0, 60)}...`);
          info(`Body preview: ${emailContent.body.slice(0, 100).replace(/\n/g, " ")}...`);
          stepResults.push({
            step: "4. Application",
            status: "pass",
            message: `${application.id}`,
          });
        }
        info(`Step 4: ${t4()}ms`);
      }
    }
    console.log("");

    // ─── STEP 5: Simulate send ──────────────────────────────────────────────
    subheader("STEP 5: Simulate send");
    const sendCheck = await canSendNow(userId);
    if (sendCheck.allowed) {
      pass(`canSendNow: allowed (${sendCheck.stats?.todayCount ?? 0}/${sendCheck.stats?.maxPerDay ?? "?"} today)`);
      stepResults.push({ step: "5. Send", status: "pass", message: "Would allow" });
    } else {
      warn(`canSendNow: ${sendCheck.reason}`);
      stepResults.push({ step: "5. Send", status: "warn", message: sendCheck.reason ?? "blocked" });
    }
    info("DRY RUN — not sending");
    console.log("");

    // ─── STEP 6: Verify state ───────────────────────────────────────────────
    subheader("STEP 6: Verify state");
    let verifyPass = true;

    if (testUserJobId) {
      const readUserJob = await prisma.userJob.findUnique({
        where: { id: testUserJobId },
        include: { globalJob: true, application: true },
      });
      if (readUserJob) {
        pass(`UserJob exists: ${readUserJob.id} (stage: ${readUserJob.stage})`);
      } else {
        fail("UserJob not found in DB");
        verifyPass = false;
      }
    }

    if (testApplicationId) {
      const readApp = await prisma.jobApplication.findUnique({
        where: { id: testApplicationId },
      });
      if (readApp && readApp.status === "DRAFT") {
        pass(`Application exists: ${readApp.id} (status: DRAFT)`);
      } else {
        fail(`Application not found or wrong status: ${readApp?.status ?? "null"}`);
        verifyPass = false;
      }
    }

    stepResults.push({
      step: "6. Verify",
      status: verifyPass ? "pass" : "fail",
      message: verifyPass ? "OK" : "State mismatch",
    });
    console.log("");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    fail(`Pipeline error: ${msg}`);
    stepResults.push({ step: "Error", status: "fail", message: msg });
  } finally {
    // ─── CLEANUP ───────────────────────────────────────────────────────────
    subheader("CLEANUP");
    try {
      if (testApplicationId) {
        await prisma.jobApplication.delete({ where: { id: testApplicationId } });
        pass("Deleted test application");
      }
      if (createdUserJobId) {
        await prisma.userJob.delete({ where: { id: createdUserJobId } });
        pass("Deleted test UserJob");
      }
      if (createdGlobalJobId) {
        await prisma.globalJob.delete({ where: { id: createdGlobalJobId } });
        pass("Deleted test GlobalJob (we created it)");
      }
    } catch (e) {
      fail(`Cleanup failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    console.log("");

    // ─── Final verdict ─────────────────────────────────────────────────────
    verdict("FINAL VERDICT");
    for (const r of stepResults) {
      const icon = r.status === "pass" ? "✅" : r.status === "warn" ? "⚠️" : "❌";
      console.log(`  ${icon} ${r.step}: ${r.message ?? r.status}`);
    }
    console.log("");

    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
