/**
 * SMTP Connection & Email Sending Test — JobPilot
 *
 * Validates SMTP config, connection, and optionally sends a test email.
 *
 * Run:  npx tsx src/scripts/test-email-sending.ts <userId>
 *       npx tsx src/scripts/test-email-sending.ts <userId> --live-send
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
} from "./test-utils";
import { decrypt, isEncrypted } from "@/lib/encryption";
import { decryptSettingsFields } from "@/lib/encryption";
import { getTransporterForUser, type EmailSettings } from "@/lib/email";
import { canSendNow, getSendingStats } from "@/lib/send-limiter";

const LIVE_SEND = process.argv.includes("--live-send");

async function main() {
  const userId = getUserId();
  const results: { name: string; ok: boolean }[] = [];

  try {
    header("SMTP & EMAIL SENDING TEST — JobPilot");
    info(`User ID: ${userId}`);
    if (LIVE_SEND) warn("--live-send enabled — will send real test email");
    console.log("");

    // Load user settings from DB
    subheader("Loading settings");
    const rawSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });
    if (!rawSettings) {
      fail("UserSettings not found");
      verdict("VERDICT: Cannot proceed — no settings");
      return;
    }
    const settings = decryptSettingsFields(rawSettings);
    pass("Settings loaded and PII decrypted");
    console.log("");

    // Test 1: SMTP config exists
    subheader("Test 1: SMTP config exists");
    const t1 = timer();
    const provider = settings.emailProvider ?? "brevo";
    let smtpOk = false;

    if (provider === "brevo") {
      const hasEnv =
        !!process.env.SMTP_HOST &&
        !!process.env.SMTP_USER &&
        !!process.env.SMTP_PASS;
      if (hasEnv) {
        pass(`Brevo env config: SMTP_HOST, SMTP_USER, SMTP_PASS set`);
        smtpOk = true;
      } else {
        fail("Brevo requires SMTP_HOST, SMTP_USER, SMTP_PASS env vars");
      }
    } else if (provider === "gmail" || provider === "outlook") {
      smtpOk = !!(settings.smtpUser && settings.smtpPass);
      if (smtpOk) {
        pass(`${provider}: smtpUser and smtpPass set`);
      } else {
        fail(`${provider}: smtpUser and smtpPass required`);
      }
    } else {
      smtpOk = !!(
        settings.smtpHost &&
        settings.smtpPort &&
        settings.smtpUser &&
        settings.smtpPass
      );
      if (smtpOk) {
        pass(`Custom: smtpHost, smtpPort, smtpUser, smtpPass set`);
      } else {
        fail("Custom: smtpHost, smtpPort, smtpUser, smtpPass all required");
      }
    }
    results.push({ name: "SMTP config", ok: smtpOk });
    info(`  (${t1()})`);
    console.log("");

    // Test 2: Decrypt SMTP password
    subheader("Test 2: Decrypt SMTP password");
    const t2 = timer();
    let decryptOk = false;
    let decryptedPass: string | null = null;

    if (provider === "brevo") {
      decryptedPass = process.env.SMTP_PASS ?? null;
      decryptOk = !!decryptedPass;
      if (decryptOk) {
        pass(`Brevo: SMTP_PASS env present`);
        info(`  Masked: ${mask(decryptedPass)}`);
      } else {
        fail("Brevo: SMTP_PASS env not set");
      }
    } else {
      const smtpPass = settings.smtpPass ?? null;
      if (!smtpPass) {
        fail("smtpPass not set");
      } else {
        decryptedPass = isEncrypted(smtpPass) ? decrypt(smtpPass) : smtpPass;
        decryptOk = !!decryptedPass;
        if (decryptOk) {
          pass(`Decrypted: ${mask(decryptedPass)}`);
          const len = decryptedPass!.length;
          if (provider === "gmail" && len === 16) {
            pass("Length 16 — looks like Gmail app password");
          } else if (provider === "gmail" && len !== 16) {
            warn(`Gmail app passwords are usually 16 chars; got ${len}`);
          }
        } else {
          fail("Failed to decrypt smtpPass");
        }
      }
    }
    results.push({ name: "Decrypt SMTP password", ok: decryptOk });
    info(`  (${t2()})`);
    console.log("");

    // Test 3: Create transporter
    subheader("Test 3: Create transporter");
    const t3 = timer();
    let transporter: Awaited<ReturnType<typeof getTransporterForUser>> | null =
      null;

    const emailSettings: EmailSettings = {
      emailProvider: settings.emailProvider,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpUser: settings.smtpUser,
      smtpPass:
        settings.smtpPass && isEncrypted(settings.smtpPass)
          ? decrypt(settings.smtpPass)
          : settings.smtpPass,
    };

    try {
      transporter = getTransporterForUser(emailSettings);
      pass("Transporter created");
      results.push({ name: "Create transporter", ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      fail(`Transporter creation failed: ${msg}`);
      results.push({ name: "Create transporter", ok: false });
    }
    info(`  (${t3()})`);
    console.log("");

    // Test 4: Verify SMTP connection
    subheader("Test 4: Verify SMTP connection");
    const t4 = timer();
    let verifyOk = false;

    if (transporter) {
      const timeoutMs = 15000;
      try {
        await Promise.race([
          transporter.verify(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Connection timeout")), timeoutMs)
          ),
        ]);
        pass("SMTP connection verified");
        verifyOk = true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        fail(`SMTP verify failed: ${msg}`);
      }
    } else {
      fail("Skipped — no transporter");
    }
    results.push({ name: "Verify SMTP connection", ok: verifyOk });
    info(`  (${t4()})`);
    console.log("");

    // Test 5: Send test email
    subheader("Test 5: Send test email");
    const t5 = timer();

    if (!LIVE_SEND) {
      warn("DRY RUN — add --live-send to actually send");
      results.push({ name: "Send test email", ok: true });
    } else if (transporter && verifyOk) {
      const toEmail =
        settings.applicationEmail ||
        settings.notificationEmail ||
        (await prisma.user.findUnique({ where: { id: userId } }))?.email;
      if (!toEmail) {
        fail("No email address to send to (applicationEmail, notificationEmail, or user.email)");
        results.push({ name: "Send test email", ok: false });
      } else {
        const fullName = settings.fullName || "JobPilot User";
        const from = `${fullName} <${toEmail}>`;
        const subject = `[JobPilot Test] SMTP verification — ${new Date().toISOString()}`;
        const html =
          "This is an automated test email from JobPilot. If you received this, your SMTP configuration is working correctly.";

        try {
          const sendResult = await transporter.sendMail({
            from,
            to: toEmail,
            subject,
            html,
          });
          pass(`Test email sent to ${mask(toEmail)} — messageId: ${sendResult.messageId ?? "(none)"}`);
          results.push({ name: "Send test email", ok: true });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          fail(`Send failed: ${msg}`);
          results.push({ name: "Send test email", ok: false });
        }
      }
    } else {
      fail("Skipped — transporter not ready or verify failed");
      results.push({ name: "Send test email", ok: false });
    }
    info(`  (${t5()})`);
    console.log("");

    // Test 6: canSendNow check
    subheader("Test 6: canSendNow check");
    const t6 = timer();
    const limitResult = await canSendNow(userId);
    if (limitResult.allowed) {
      pass(`Allowed: yes`);
      if (limitResult.stats) {
        info(
          `  today: ${limitResult.stats.todayCount}/${limitResult.stats.maxPerDay}, hour: ${limitResult.stats.hourCount}/${limitResult.stats.maxPerHour}`
        );
      }
    } else {
      warn(`Allowed: no — ${limitResult.reason ?? "unknown"}`);
      if (limitResult.waitSeconds) {
        info(`  Wait: ${limitResult.waitSeconds}s`);
      }
      if (limitResult.stats) {
        info(
          `  today: ${limitResult.stats.todayCount}/${limitResult.stats.maxPerDay}, hour: ${limitResult.stats.hourCount}/${limitResult.stats.maxPerHour}`
        );
      }
    }
    results.push({ name: "canSendNow", ok: limitResult.allowed });
    info(`  (${t6()})`);
    console.log("");

    // Test 7: getSendingStats
    subheader("Test 7: getSendingStats");
    const t7 = timer();
    const stats = await getSendingStats(userId);
    info(
      `  today: ${stats.todaySent}/${stats.todayMax}, hour: ${stats.hourSent}/${stats.hourMax}`
    );
    if (stats.isPaused && stats.pausedUntil) {
      warn(`  Paused until: ${stats.pausedUntil.toISOString()}`);
    } else {
      pass("Not paused");
    }
    results.push({ name: "getSendingStats", ok: true });
    info(`  (${t7()})`);
    console.log("");

    // Verdict
    const allOk = results.every((r) => r.ok);
    verdict(
      allOk
        ? "VERDICT: All tests passed"
        : "VERDICT: Some tests failed"
    );
    const passCount = results.filter((r) => r.ok).length;
    const failCount = results.filter((r) => !r.ok).length;
    console.log(`  ${passCount} passed, ${failCount} failed`);
    console.log("");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  \x1b[31m❌ Fatal error: ${msg}\x1b[0m`);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => process.exit(1));
