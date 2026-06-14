#!/usr/bin/env node
/**
 * Vercel build wrapper for `prisma migrate deploy`.
 *
 * Prisma migrate requires a direct (unpooled) Postgres connection because
 * it uses session-level features (`pg_advisory_lock`) that PgBouncer
 * pooled connections can't reliably forward. Without this, builds fail with:
 *   "Timed out trying to acquire a postgres advisory lock"
 *
 * Behavior:
 *   1. If DIRECT_URL is already set as an env var (best practice), use it as-is.
 *   2. Otherwise, derive DIRECT_URL from DATABASE_URL by stripping the
 *      "-pooler" segment (standard Neon naming convention).
 *   3. Run `prisma generate` then `prisma migrate deploy` with the derived env.
 *
 * Runs in CI/Vercel build. No-op locally if DATABASE_URL is already direct.
 */

import { spawnSync } from "node:child_process";

const env = { ...process.env };

// ── Environment gate ────────────────────────────────────────────────────
// Vercel sets VERCEL_ENV=production for production deploys, preview for
// PR previews, and development for local dev. Previously this script ran
// `prisma migrate deploy` against whatever DATABASE_URL was set, which
// meant a PR preview pointed at the production DB would happily mutate
// the production schema. Production audit flagged this as a critical
// deploy-safety bug.
//
// New behavior:
//   - VERCEL_ENV=production  → run prisma generate + migrate deploy as before
//   - VERCEL_ENV=preview     → run prisma generate ONLY (no migration)
//   - VERCEL_ENV=development → run prisma generate ONLY
//   - VERCEL_ENV unset (local CLI invocation) → run both (back-compat for
//     local dev who explicitly runs this script)
//
// To override (e.g. you genuinely want preview deploys to migrate against
// a Neon branch DB), set ALLOW_NON_PRODUCTION_MIGRATE=1.
const vercelEnv = env.VERCEL_ENV ?? null;
const allowNonProd = env.ALLOW_NON_PRODUCTION_MIGRATE === "1";
const shouldRunMigrate =
  vercelEnv === null /* local */ ||
  vercelEnv === "production" ||
  allowNonProd;

if (vercelEnv && vercelEnv !== "production" && !allowNonProd) {
  console.log(
    `[migrate-prod] VERCEL_ENV=${vercelEnv} — running prisma generate only. ` +
      `Skipping migrate deploy (would otherwise race against prod schema). ` +
      `Set ALLOW_NON_PRODUCTION_MIGRATE=1 to override.`,
  );
}

if (!env.DATABASE_URL) {
  console.error("[migrate-prod] DATABASE_URL is not set — cannot derive DIRECT_URL");
  process.exit(1);
}

if (!env.DIRECT_URL) {
  // Neon convention: pooled hostnames contain "-pooler.", direct ones don't.
  // Examples:
  //   pooled: ep-foo-bar-pooler.c-4.us-east-1.aws.neon.tech
  //   direct: ep-foo-bar.c-4.us-east-1.aws.neon.tech
  const derived = env.DATABASE_URL.replace(/-pooler\./, ".");
  if (derived === env.DATABASE_URL) {
    // No "-pooler" found — either already direct, or not a Neon URL.
    // Either way, reuse DATABASE_URL as DIRECT_URL.
    console.log("[migrate-prod] DATABASE_URL is not pooled; reusing for DIRECT_URL");
  } else {
    console.log("[migrate-prod] Derived DIRECT_URL by stripping '-pooler'");
  }
  env.DIRECT_URL = derived;
} else {
  console.log("[migrate-prod] Using explicit DIRECT_URL env var");
}

function run(cmd, args) {
  console.log(`[migrate-prod] $ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

run("npx", ["prisma", "generate"]);
if (shouldRunMigrate) {
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.log("[migrate-prod] Skipping `prisma migrate deploy` (non-production env).");
}
