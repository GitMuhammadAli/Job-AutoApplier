/**
 * Standalone test: Complete application lifecycle for JobPilot.
 *
 * Run:  npx tsx src/scripts/test-application-flow.ts <userId>
 *
 * Tests: DRAFT creation, findCompanyEmail, status transitions, atomic claim, cleanup.
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
import { findCompanyEmail } from "@/lib/email-extractor";

async function main() {
  const userId = getUserId();
  let testAppId: string | null = null;

  try {
    header("APPLICATION LIFECYCLE TEST — JobPilot");
    info(`User ID: ${userId}`);
    console.log("");

    // ── Setup: Pick a real UserJob ──
    subheader("Setup: Find UserJob");
    const setupTimer = timer();
    const userJob = await prisma.userJob.findFirst({
      where: {
        userId,
        stage: "SAVED",
        isDismissed: false,
        application: null,
        globalJob: {
          description: { not: null },
        },
      },
      orderBy: { matchScore: "desc" },
      include: { globalJob: true },
    });

    if (!userJob) {
      fail("No UserJob found (stage=SAVED, has description, no existing application)");
      verdict("VERDICT: Cannot proceed — no suitable UserJob");
      return;
    }

    pass(`Found UserJob: ${userJob.id} (matchScore: ${userJob.matchScore ?? "N/A"})`);
    pass(`GlobalJob: ${userJob.globalJob.title} @ ${userJob.globalJob.company}`);
    info(`Setup: ${setupTimer()}ms`);
    console.log("");

    const globalJob = userJob.globalJob;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const senderEmail = user?.email ?? "test@example.com";

    // ── Test 1: Create DRAFT application ──
    subheader("Test 1: Create DRAFT application");
    const t1 = timer();
    const draftApp = await prisma.jobApplication.create({
      data: {
        userId,
        userJobId: userJob.id,
        senderEmail,
        recipientEmail: "hr@example.com",
        subject: "[Test] Application for " + globalJob.title,
        emailBody: "Synthetic body for application lifecycle test.",
        status: "DRAFT",
      },
    });
    testAppId = draftApp.id;
    if (draftApp.status === "DRAFT") {
      pass(`Created DRAFT application: ${draftApp.id}`);
    } else {
      fail(`Expected DRAFT, got ${draftApp.status}`);
    }
    info(`Test 1: ${t1()}ms`);
    console.log("");

    // ── Test 2: Find company email ──
    subheader("Test 2: Find company email");
    const t2 = timer();
    const emailResult = await findCompanyEmail({
      description: globalJob.description,
      company: globalJob.company,
      sourceUrl: globalJob.sourceUrl,
      applyUrl: globalJob.applyUrl,
      companyUrl: globalJob.companyUrl,
    });
    info(`Result: email=${emailResult.email ?? "(null)"} confidence=${emailResult.confidence} method=${emailResult.method}`);
    if (emailResult.email || emailResult.confidence !== "NONE") {
      pass("findCompanyEmail returned result");
    } else {
      warn("findCompanyEmail returned NONE (may be expected for some jobs)");
    }
    info(`Test 2: ${t2()}ms`);
    console.log("");

    // ── Test 3: Status transitions ──
    subheader("Test 3: Status transitions");

    // DRAFT → READY (set scheduledSendAt)
    const t3a = timer();
    await prisma.jobApplication.update({
      where: { id: testAppId },
      data: { status: "READY", scheduledSendAt: new Date(Date.now() + 60000) },
    });
    const afterReady = await prisma.jobApplication.findUnique({ where: { id: testAppId } });
    if (afterReady?.status === "READY" && afterReady.scheduledSendAt) {
      pass("DRAFT → READY (scheduledSendAt set)");
    } else {
      fail(`DRAFT → READY failed: status=${afterReady?.status}`);
    }
    info(`DRAFT→READY: ${t3a()}ms`);

    // READY → CANCELLED
    const t3b = timer();
    await prisma.jobApplication.update({
      where: { id: testAppId },
      data: { status: "CANCELLED", scheduledSendAt: null },
    });
    const afterCancelled = await prisma.jobApplication.findUnique({ where: { id: testAppId } });
    if (afterCancelled?.status === "CANCELLED") {
      pass("READY → CANCELLED");
    } else {
      fail(`READY → CANCELLED failed: status=${afterCancelled?.status}`);
    }
    info(`READY→CANCELLED: ${t3b()}ms`);

    // CANCELLED → DRAFT (requeue)
    const t3c = timer();
    await prisma.jobApplication.update({
      where: { id: testAppId },
      data: { status: "DRAFT" },
    });
    const afterRequeue = await prisma.jobApplication.findUnique({ where: { id: testAppId } });
    if (afterRequeue?.status === "DRAFT") {
      pass("CANCELLED → DRAFT (requeue)");
    } else {
      fail(`CANCELLED → DRAFT failed: status=${afterRequeue?.status}`);
    }
    info(`CANCELLED→DRAFT: ${t3c()}ms`);

    // DRAFT → READY → SENDING (atomic claim)
    const t3d = timer();
    await prisma.jobApplication.update({
      where: { id: testAppId },
      data: { status: "READY", scheduledSendAt: new Date(Date.now() + 60000) },
    });
    const claim1 = await prisma.jobApplication.updateMany({
      where: { id: testAppId, status: "READY" },
      data: { status: "SENDING" },
    });
    if (claim1.count === 1) {
      pass("Atomic claim: first claim count=1");
    } else {
      fail(`Atomic claim: expected count=1, got ${claim1.count}`);
    }
    info(`DRAFT→READY→SENDING (atomic): ${t3d()}ms`);

    // Second claim should return count=0
    const t3e = timer();
    const claim2 = await prisma.jobApplication.updateMany({
      where: { id: testAppId, status: "READY" },
      data: { status: "SENDING" },
    });
    if (claim2.count === 0) {
      pass("Atomic claim: second claim count=0 (already SENDING)");
    } else {
      fail(`Atomic claim: expected count=0 for duplicate claim, got ${claim2.count}`);
    }
    info(`Second claim check: ${t3e()}ms`);

    // SENDING → SENT (set sentAt)
    const t3f = timer();
    await prisma.jobApplication.update({
      where: { id: testAppId },
      data: { status: "SENT", sentAt: new Date() },
    });
    const afterSent = await prisma.jobApplication.findUnique({ where: { id: testAppId } });
    if (afterSent?.status === "SENT" && afterSent.sentAt) {
      pass("SENDING → SENT (sentAt set)");
    } else {
      fail(`SENDING → SENT failed: status=${afterSent?.status}`);
    }
    info(`SENDING→SENT: ${t3f()}ms`);

    // Reset to DRAFT, then DRAFT → READY → SENDING → FAILED
    const t3g = timer();
    await prisma.jobApplication.update({
      where: { id: testAppId },
      data: { status: "DRAFT", sentAt: null },
    });
    await prisma.jobApplication.update({
      where: { id: testAppId },
      data: { status: "READY", scheduledSendAt: new Date(Date.now() + 60000) },
    });
    const claim3 = await prisma.jobApplication.updateMany({
      where: { id: testAppId, status: "READY" },
      data: { status: "SENDING" },
    });
    if (claim3.count !== 1) {
      fail(`Reset claim: expected count=1, got ${claim3.count}`);
    }
    await prisma.jobApplication.update({
      where: { id: testAppId },
      data: { status: "FAILED", errorMessage: "Test failure reason", retryCount: 1 },
    });
    const afterFailed = await prisma.jobApplication.findUnique({ where: { id: testAppId } });
    if (
      afterFailed?.status === "FAILED" &&
      afterFailed.errorMessage === "Test failure reason" &&
      afterFailed.retryCount === 1
    ) {
      pass("DRAFT → READY → SENDING → FAILED (errorMessage, retryCount)");
    } else {
      fail(`FAILED transition: status=${afterFailed?.status} errorMessage=${afterFailed?.errorMessage}`);
    }
    info(`Full cycle to FAILED: ${t3g()}ms`);

    // FAILED → READY (retry)
    const t3h = timer();
    await prisma.jobApplication.update({
      where: { id: testAppId },
      data: { status: "READY", scheduledSendAt: new Date(Date.now() + 60000) },
    });
    const afterRetry = await prisma.jobApplication.findUnique({ where: { id: testAppId } });
    if (afterRetry?.status === "READY") {
      pass("FAILED → READY (retry)");
    } else {
      fail(`FAILED → READY failed: status=${afterRetry?.status}`);
    }
    info(`FAILED→READY: ${t3h()}ms`);

    verdict("VERDICT: Application lifecycle tests completed");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    fail(`Unexpected error: ${msg}`);
    verdict("VERDICT: Tests failed");
  } finally {
    if (testAppId) {
      subheader("Cleanup");
      try {
        await prisma.jobApplication.delete({ where: { id: testAppId } });
        pass("Deleted test application");
      } catch (e) {
        fail(`Cleanup failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await prisma.$disconnect();
  }
}

main();
