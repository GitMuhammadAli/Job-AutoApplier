#!/usr/bin/env node
/**
 * One-off backfill: AES-256-CBC (v1) → AES-256-GCM (v2) for stored secrets.
 *
 * After the 2026-06-14 encryption upgrade (src/lib/encryption.ts), new writes
 * always go through GCM and `encryptField()` upgrades v1 ciphertext on save.
 * That works fine for fields that change regularly — but SMTP passwords,
 * default signatures, and similar PII can sit untouched for months. Those
 * rows stay on the auth-tag-less v1 format until someone re-saves them.
 *
 * This script walks every UserSettings row, decrypts each PII field, and
 * re-encrypts under v2. Idempotent: rows that are already v2 (or empty)
 * are skipped. Safe to re-run.
 *
 * Usage:
 *   node scripts/migrate-encryption-v1-to-v2.mjs              # dry-run
 *   APPLY=1 node scripts/migrate-encryption-v1-to-v2.mjs      # commit
 *
 * Environment:
 *   DATABASE_URL must point at the target DB.
 *   ENCRYPTION_KEY must be the SAME key the v1 rows were encrypted under
 *   (because the script reads them). If you rotated the key, decryption
 *   will throw — restore the old key for the migration.
 *
 * Output: per-row line "userId field v1→v2" and a final tally.
 *
 * NOTE: We touch only the columns the runtime encryption layer manages
 *   (the PII_FIELDS list in src/lib/encryption.ts). If you add a new PII
 *   column there, mirror it in PII_FIELDS below or it gets silently
 *   skipped on the next sweep.
 */

import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const PII_FIELDS = [
  "fullName",
  "phone",
  "linkedinUrl",
  "portfolioUrl",
  "githubUrl",
  "notificationEmail",
  "applicationEmail",
  "smtpHost",
  "smtpUser",
  "smtpPass",
  "defaultSignature",
  "customClosing",
  "customSystemPrompt",
];

const V2_PREFIX = "v2:";

function isV2(s) {
  return typeof s === "string" && s.startsWith(V2_PREFIX);
}
function isV1(s) {
  return (
    typeof s === "string" &&
    !s.startsWith(V2_PREFIX) &&
    /^[0-9a-f]{32}:[0-9a-f]+$/.test(s)
  );
}

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY env var is required");
  return Buffer.from(key, "hex");
}

function decryptV1(text) {
  const [ivHex, encHex] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getKey(), iv);
  let out = decipher.update(encHex, "hex", "utf8");
  out += decipher.final("utf8");
  return out;
}

function encryptV2(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${V2_PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

async function main() {
  const apply = process.env.APPLY === "1";
  console.log(apply ? "Mode: APPLY (will write changes)" : "Mode: DRY RUN");
  const prisma = new PrismaClient();
  try {
    const settings = await prisma.userSettings.findMany({});
    let rowsScanned = 0;
    let rowsTouched = 0;
    let fieldsUpgraded = 0;
    let v1ErrorFields = 0;
    for (const row of settings) {
      rowsScanned++;
      const updates = {};
      for (const field of PII_FIELDS) {
        const value = row[field];
        if (typeof value !== "string" || value === "") continue;
        if (isV2(value)) continue;
        if (!isV1(value)) continue; // plaintext or unknown shape — leave alone
        try {
          const plaintext = decryptV1(value);
          updates[field] = encryptV2(plaintext);
          fieldsUpgraded++;
          process.stdout.write(
            `  ${row.userId.slice(0, 8)}… ${field} v1→v2\n`,
          );
        } catch (err) {
          v1ErrorFields++;
          process.stdout.write(
            `  ${row.userId.slice(0, 8)}… ${field} DECRYPT FAILED: ${err.message}\n`,
          );
        }
      }
      if (Object.keys(updates).length > 0) {
        rowsTouched++;
        if (apply) {
          await prisma.userSettings.update({
            where: { userId: row.userId },
            data: updates,
          });
        }
      }
    }
    console.log("");
    console.log(`Rows scanned     : ${rowsScanned}`);
    console.log(`Rows touched     : ${rowsTouched}`);
    console.log(`Fields upgraded  : ${fieldsUpgraded}`);
    console.log(`Decrypt errors   : ${v1ErrorFields}`);
    if (!apply && rowsTouched > 0) {
      console.log("");
      console.log("Dry run — set APPLY=1 to commit.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
