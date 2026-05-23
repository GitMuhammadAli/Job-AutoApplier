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
run("npx", ["prisma", "migrate", "deploy"]);
