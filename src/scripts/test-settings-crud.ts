/**
 * Standalone test: Settings CRUD + encryption for JobPilot UserSettings.
 *
 * Run:  npx tsx src/scripts/test-settings-crud.ts <userId>
 *
 * Requires: DATABASE_URL, ENCRYPTION_KEY (for smtpPass encryption tests)
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
import {
  encrypt,
  decrypt,
  isEncrypted,
  encryptField,
  decryptField,
} from "@/lib/encryption";

type ApplicationMode = "MANUAL" | "SEMI_AUTO" | "FULL_AUTO" | "INSTANT";

interface SettingsBackup {
  keywords: string[];
  preferredCategories: string[];
  preferredPlatforms: string[];
  applicationMode: ApplicationMode;
  smtpPass: string | null;
  minMatchScoreForAutoApply: number;
  sendDelaySeconds: number;
  instantApplyDelay: number | null;
}

async function getSettings(userId: string) {
  const s = await prisma.userSettings.findUnique({ where: { userId } });
  if (!s) throw new Error(`No UserSettings found for userId: ${userId}`);
  return s;
}

async function backupSettings(userId: string): Promise<SettingsBackup> {
  const s = await getSettings(userId);
  return {
    keywords: [...(s.keywords || [])],
    preferredCategories: [...(s.preferredCategories || [])],
    preferredPlatforms: [...(s.preferredPlatforms || [])],
    applicationMode: s.applicationMode as ApplicationMode,
    smtpPass: s.smtpPass,
    minMatchScoreForAutoApply: s.minMatchScoreForAutoApply ?? 75,
    sendDelaySeconds: s.sendDelaySeconds ?? 120,
    instantApplyDelay: s.instantApplyDelay,
  };
}

async function restoreSettings(userId: string, backup: SettingsBackup) {
  await prisma.userSettings.update({
    where: { userId },
    data: {
      keywords: backup.keywords,
      preferredCategories: backup.preferredCategories,
      preferredPlatforms: backup.preferredPlatforms,
      applicationMode: backup.applicationMode,
      smtpPass: backup.smtpPass,
      minMatchScoreForAutoApply: backup.minMatchScoreForAutoApply,
      sendDelaySeconds: backup.sendDelaySeconds,
      instantApplyDelay: backup.instantApplyDelay,
    },
  });
}

async function main() {
  const userId = getUserId();

  header("SETTINGS CRUD + ENCRYPTION TEST");
  info(`userId: ${userId}`);
  console.log("");

  // ── Read current settings as backup ──
  subheader("Backup");
  let backup: SettingsBackup;
  try {
    backup = await backupSettings(userId);
    pass(`Backed up keywords (${backup.keywords.length}), mode=${backup.applicationMode}`);
  } catch (e: any) {
    fail(`Could not load settings: ${e.message}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const results: { name: string; status: "pass" | "warn" | "fail"; issues: string[] }[] = [];

  // ── Test 1: Read and display current settings (timing) ──
  subheader("Test 1: Read & display current settings");
  const t1 = timer();
  try {
    const s = await getSettings(userId);
    const elapsed = t1();
    info(`Read in ${elapsed}`);
    info(`keywords: [${(s.keywords || []).slice(0, 5).join(", ")}${(s.keywords?.length ?? 0) > 5 ? "..." : ""}]`);
    info(`preferredCategories: [${(s.preferredCategories || []).slice(0, 3).join(", ")}]`);
    info(`preferredPlatforms: [${(s.preferredPlatforms || []).slice(0, 3).join(", ")}]`);
    info(`applicationMode: ${s.applicationMode}`);
    info(`smtpPass: ${mask(s.smtpPass)}`);
    info(`sendDelaySeconds: ${s.sendDelaySeconds ?? 120}`);
    info(`instantApplyDelay: ${s.instantApplyDelay ?? "null"}`);
    pass(`Read OK`);
    results.push({ name: "Read settings", status: "pass", issues: [] });
  } catch (e: any) {
    fail(`Read failed: ${e.message}`);
    results.push({ name: "Read settings", status: "fail", issues: [e.message] });
  }

  // ── Test 2: Keyword round-trip ──
  subheader("Test 2: Keyword round-trip");
  const testKeywords = ["react", "next.js", "typescript"];
  try {
    await prisma.userSettings.update({
      where: { userId },
      data: { keywords: testKeywords },
    });
    const read = await getSettings(userId);
    const match =
      Array.isArray(read.keywords) &&
      read.keywords.length === testKeywords.length &&
      testKeywords.every((k, i) => read.keywords![i] === k);
    if (match) {
      pass(`Write → read round-trip OK: [${testKeywords.join(", ")}]`);
      results.push({ name: "Keyword round-trip", status: "pass", issues: [] });
    } else {
      fail(`Mismatch: wrote ${JSON.stringify(testKeywords)}, got ${JSON.stringify(read.keywords)}`);
      results.push({
        name: "Keyword round-trip",
        status: "fail",
        issues: [`Expected ${JSON.stringify(testKeywords)}, got ${JSON.stringify(read.keywords)}`],
      });
    }
  } catch (e: any) {
    fail(`Keyword round-trip failed: ${e.message}`);
    results.push({ name: "Keyword round-trip", status: "fail", issues: [e.message] });
  } finally {
    await restoreSettings(userId, backup);
    info("Restored original keywords");
  }

  // ── Test 3: Mode change round-trip ──
  subheader("Test 3: Mode change round-trip");
  const modes: ApplicationMode[] = ["MANUAL", "SEMI_AUTO", "FULL_AUTO"];
  try {
    for (const mode of modes) {
      await prisma.userSettings.update({
        where: { userId },
        data: { applicationMode: mode },
      });
      const read = await getSettings(userId);
      if (read.applicationMode === mode) {
        pass(`Mode ${mode} round-trip OK`);
      } else {
        fail(`Mode mismatch: wrote ${mode}, got ${read.applicationMode}`);
      }
    }
    results.push({ name: "Mode round-trip", status: "pass", issues: [] });
  } catch (e: any) {
    fail(`Mode round-trip failed: ${e.message}`);
    results.push({ name: "Mode round-trip", status: "fail", issues: [e.message] });
  } finally {
    await restoreSettings(userId, backup);
    info("Restored original applicationMode");
  }

  // ── Test 4: SMTP encryption ──
  subheader("Test 4: SMTP encryption");
  const smtpIssues: string[] = [];
  if (!process.env.ENCRYPTION_KEY) {
    warn("ENCRYPTION_KEY not set — skipping encryption tests");
    results.push({ name: "SMTP encryption", status: "warn", issues: ["ENCRYPTION_KEY missing"] });
  } else {
    try {
      const plain = "mySecretPassword123";
      const enc = encrypt(plain);
      const dec = decrypt(enc);
      if (dec !== plain) {
        fail(`Encrypt/decrypt mismatch: "${plain}" → "${dec}"`);
        smtpIssues.push("Round-trip mismatch");
      } else {
        pass(`encrypt/decrypt round-trip OK`);
      }
      if (!isEncrypted(enc)) {
        fail(`isEncrypted("${enc.slice(0, 20)}...") should be true`);
        smtpIssues.push("isEncrypted format invalid");
      } else {
        pass(`isEncrypted format OK (iv_hex:ciphertext_hex)`);
      }
      const encField = encryptField(plain);
      const decField = decryptField(encField);
      if (decField !== plain) {
        fail(`encryptField/decryptField mismatch`);
        smtpIssues.push("encryptField/decryptField mismatch");
      } else {
        pass(`encryptField/decryptField OK`);
      }
      const dbSmtp = (await getSettings(userId)).smtpPass;
      if (dbSmtp && isEncrypted(dbSmtp)) {
        const decDb = decryptField(dbSmtp);
        pass(`DB smtpPass is encrypted; decryptField returns ${decDb ? mask(decDb) : "null"}`);
      } else if (dbSmtp) {
        warn(`DB smtpPass is plaintext (not encrypted)`);
      } else {
        info("smtpPass not set in DB");
      }
      results.push({
        name: "SMTP encryption",
        status: smtpIssues.length > 0 ? "fail" : "pass",
        issues: smtpIssues,
      });
    } catch (e: any) {
      fail(`SMTP encryption test failed: ${e.message}`);
      results.push({ name: "SMTP encryption", status: "fail", issues: [e.message] });
    }
  }

  // ── Test 5: Edge cases (keywords) ──
  subheader("Test 5: Edge cases — keywords");
  const edgeCases: { label: string; keywords: string[] }[] = [
    { label: "empty []", keywords: [] },
    { label: "special chars [c++]", keywords: ["c++"] },
    { label: "unicode [ünit]", keywords: ["ünit"] },
    { label: "mixed", keywords: ["react", "c++", "c#", "ünit", "node.js"] },
  ];
  let edgeOk = true;
  for (const tc of edgeCases) {
    try {
      await prisma.userSettings.update({
        where: { userId },
        data: { keywords: tc.keywords },
      });
      const read = await getSettings(userId);
      const match =
        Array.isArray(read.keywords) &&
        read.keywords.length === tc.keywords.length &&
        tc.keywords.every((k, i) => read.keywords![i] === k);
      if (match) {
        pass(`${tc.label}: OK`);
      } else {
        fail(`${tc.label}: wrote ${JSON.stringify(tc.keywords)}, got ${JSON.stringify(read.keywords)}`);
        edgeOk = false;
      }
    } catch (e: any) {
      fail(`${tc.label}: ${e.message}`);
      edgeOk = false;
    } finally {
      await restoreSettings(userId, backup);
    }
  }
  info("Restored original keywords after each edge case");
  results.push({
    name: "Edge cases",
    status: edgeOk ? "pass" : "fail",
    issues: edgeOk ? [] : ["One or more edge cases failed"],
  });

  // ── Verdict ──
  verdict("VERDICT");
  const passes = results.filter((r) => r.status === "pass").length;
  const warns_ = results.filter((r) => r.status === "warn").length;
  const fails_ = results.filter((r) => r.status === "fail").length;
  console.log(`  ${passes} ✅  ${warns_} ⚠️  ${fails_} ❌`);
  const allIssues = results.flatMap((r) => r.issues.map((i) => `[${r.name}] ${i}`));
  if (allIssues.length > 0) {
    console.log("");
    console.log("  Issues:");
    for (const issue of allIssues) {
      console.log(`    • ${issue}`);
    }
  }
  console.log("");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Test failed:", e);
  prisma.$disconnect();
  process.exit(1);
});
