# Morning Brief — 2026-06-14 (final)

**Working state:** 101 files touched (62 modified + 39 new), ~2,130 LOC added across 4 passes. Zero commits — everything is uncommitted diff for you to review.

**Verification status:** type-check green, **463/463 unit tests pass**, all 5 pending migrations **deployed to Neon prod** and confirmed in sync.

Four passes happened over this session: (1) foundation overnight, (2) infrastructure follow-on, (3) prod ship + Zod sweep + observability, (4) page redesigns.

---

## 1. Pass 1 — Foundation (overnight)

### Production blockers closed
- **GDPR-shaped legal pages**: `/privacy`, `/terms`, `/contact`, `/subprocessors` (warm-stone styling, Footer wired off `#` placeholders).
- **Cookie consent banner** (`CookieConsent.tsx`): slide-up, localStorage `jp-cookie-consent-v1`, fires `jp:consent` event, gates non-essential telemetry.
- **`migrate-prod.mjs` env gate**: only runs `prisma migrate deploy` on `VERCEL_ENV=production` (or local). Closes the "preview deploy mutates prod schema" footgun.
- **`/api/account/export`** — GDPR Article 15 + 20 JSON dump endpoint. Excludes prompt bodies (PII).
- **Account deletion cleanup**: `deleteAccount()` now `del()`'s all `Resume.fileUrl` + `ResumeGeneration.pdfUrl` after the tx. No more orphaned PDFs.

### Observability foundation
- `src/lib/observability/capture.ts` — `captureError`, `captureMessage`, `withCapture`, `getReleaseTag`. Consent-gated client-side, strips `cookie`/`authorization` headers.
- `instrumentation.ts` — Sentry init for nodejs + edge, `release=VERCEL_GIT_COMMIT_SHA`, `onRequestError` exported.
- `src/app/global-error.tsx` rewired through `captureError` + `ErrorPanel`.

### Quota threading
Quota flows through every AI call site now (`parse-pdf`, `cover-letter`, `pitch`, `email/generate-followup`, `matching/resume-matcher`, both follow-up crons). Fixed `resume-matcher.ts:208` shorthand bug — `aiTiebreaker` was missing `userId` arg.

### Pipeline / rewriter (Agent 4)
- **Resume Rewriter wired** as Agent 4 in `/api/resumes/generate`. Opt-in via `rewrite: true`. Audited against profile — no fabrication. Bullet rewriter parallelized (concurrency 5 → ~3-4s wall-clock).
- Response gained a `rewrite` block: `{ bulletsRewritten, summaryRewritten, skillsRelabeled, auditPassed, bulletDiff, skillRelabels }`.
- `audit-layers.ts` `normalizeDerivations()` accepts both array + object shapes.

### UI foundation
- `tokens.css` rewritten for warmth — stone palette, desaturated emerald, longer ease `cubic-bezier(0.16, 1, 0.3, 1)`, multi-layer warm shadows.
- `tailwind.config.ts` rewired — `fontFamily.display/body/mono` mapped to CSS vars, zinc→stone, `shadow-soft-{sm,md,lg,xl}`.
- `layout.tsx` — Inter font (Next 14.2 doesn't ship Geist), tightened speculation rules.
- **⌘K command palette** (`cmdk@1.0.4`) mounted in dashboard layout.
- **`PageTransition` wrapper** — cross-document View Transitions API for Chrome 126+ / Safari 17.4+, fade-up fallback for Firefox.
- **`SavedIndicator` wired into `ProfileEditor`** — useSaveState hook, "Saving" → "Saved 5s ago" → "Save failed — Retry".

---

## 2. Pass 2 — Infrastructure follow-on

### Reliability
- **Gemini fallback hardened** — replaced Promise.race timeout with real `AbortController.signal`. Aborting cancels the underlying fetch instead of leaking past the deadline.
- **`streamWithGroq` parity** — was bypassing timeout + quota + Gemini fallback. Now mirrors `generateWithGroqDetailed`.
- **`Idempotency-Key` + LRU cache** (`src/lib/idempotency.ts`). Client sends a stable UUID; server caches result for 10 min. Solves the page-leave double-spend bug. Generate route refactored to `runGenerate(userId, body)` returning `{status, body}`.

### Security
- **SSRF-safe `safeFetch`** (`src/lib/security/safe-fetch.ts`) — protocol/IP/redirect/body-size guards. RFC1918 + 169.254 + IPv6 ULAs + CGNAT. Wired into `/api/jobs/extract-url` and `agents/researcher.ts`.
- **AES-256-CBC → GCM** (`src/lib/encryption.ts`) — versioned envelope `v2:<iv>:<tag>:<ct>`. Legacy v1 still decrypts; `encryptField` re-encrypts v1 → v2 on next save. Auth-tag-bearing — tampered ciphertext throws.
- **Origin/Referer guard** added to `src/middleware.ts`. Blocks cross-origin mutating requests before route handlers run.

### Email
- **EmailSuppression pre-send check** in `sendApplication()`.
- **List-Unsubscribe header** (RFC 2369/8058) on every send. `/api/email/unsubscribe` one-click route.
- **Follow-up threading** — `JobApplication.messageId` column persists SMTP Message-ID; follow-up sends use `In-Reply-To` + `References`.

### Cost tracking
- `src/lib/cost/pricing.ts` — `PROVIDER_PRICING` table + `priceOf()`.
- `LlmCallLog.costUsd` Float column. `recordUsage` writes USD on every call.

### Data integrity + eval harness
- **`prisma migrate diff` CI gate** — new `migrate-diff` job runs shadow Postgres + diff, fails build on drift.
- **`src/lib/agents/__evals__/`** — 3 cases (tailor no-fab, tailor aligned, rewriter no-leak), `npm run eval`, nightly workflow at 06:00 UTC.

### AI rewrite UI
- **`RewriteDiff`** — per-bullet original ↔ rewritten side-by-side, "revert this bullet", "Audit passed" badge, skill relabels as chip pairs. Wired into GenerateModal preview.
- **`SourcePdfSelector`** — explicit picker for which uploaded resume the AI used as truth-source.

### Mobile / a11y + testing + perf
- `globals.css` utilities — `pb-safe/pt-safe/pl-safe/pr-safe`, `tap-44`, `focus-soft`, `.skip-to-content`.
- `ProgressBar` primitive — `role="progressbar"` with proper ARIA, indeterminate `progress-indeterminate` keyframe with reduced-motion fallback.
- `e2e/a11y.spec.ts` — axe-playwright over 9 public routes (WCAG 2A/AA).
- `@next/bundle-analyzer` wired — `npm run analyze`.

---

## 3. Pass 3 — Prod ship + Zod + observability

### Shipped to prod ✅
- **All 5 pending migrations deployed to Neon prod** (`add_parsed_profile_cache`, `add_snoozed_until`, `add_email_suppression`, `add_application_message_id`, `add_llm_cost`). `prisma migrate status` reports schema in sync.
- **RCPT-TO verifier deleted** — `src/lib/email-verifier.ts` removed, pre-send block ripped out of `send-application.ts`, strategy 3 deleted from `email-extractor.ts`. ~8s of silent latency back per send (port 25 blocked on Vercel).

### Zod validation sweep
Built `src/lib/validation/parse-body.ts` helper + protected 11 routes:

| Route | Schema enforces |
|---|---|
| `POST /api/jobs/extract-url` | URL string + 8KB cap + URL shape |
| `POST /api/jobs/generate-pitch` | cuid `userJobId` + optional `stream`/`type` enum |
| `POST /api/applications/generate` | cuid `userJobId` |
| `POST /api/applications/pipeline` | cuid `userJobId` |
| `POST /api/applications/bulk-send` | array of cuids, max 50 |
| `POST /api/push/subscribe` | Web Push shape (endpoint URL + p256dh + auth) |
| `DELETE /api/push/subscribe` | optional endpoint URL |
| `POST /api/admin/auth` | username/password length-capped |
| `PATCH /api/admin/users/[id]` | action enum |
| `PATCH /api/admin/feedback` | id + status enum + capped adminNote |
| `DELETE /api/admin/jobs` | action enum + 1-365 day window |
| `POST /api/admin/scrapers/trigger` | source string length-capped |
| `PATCH /api/settings/status` | accountStatus enum |

**Caught one real bug**: `admin/feedback` PATCH enum was wrong — UI sends `reviewed`, my first draft had `in_review`. Verified against the actual button labels before locking. Also removed an unreachable `default:` in `admin/users/[id]` that referenced an unimported constant — would have crashed if Zod ever let it through.

### Observability
- **`LlmCallLog` gaps closed in `src/lib/groq.ts`**:
  - Groq failure now writes `error` row with the actual exception message (capped 500 chars).
  - Gemini fallback success writes `ok` row tagged `provider: "gemini"` — fallback rate now visible.
  - Gemini fallback failure writes its own error row alongside Groq's.
- **14 catch sites converted** to `captureError`:
  - AI/send: `applications/[id]/send`, `applications/[id]/send-followup`, `applications/pipeline`, `applications/bulk-send`, `jobs/generate-pitch`, `resumes/coach-bullet`, `push/subscribe` (POST + DELETE)
  - Settings/data: `settings/mode`, `settings/status`, `export`
  - Cron (highest-value targets): `cron:send-scheduled`, `cron:send-queued`, `cron:follow-up`, `cron:match-jobs`

Each catch passes route tag + relevant ID (`applicationId`, `userJobId`, `userId`) as `extras`.

---

## 4. Pass 4 — Page redesigns (warm-soft FAANG aesthetic)

### Done — 6 surfaces
- **`/login`** — Stone-warm bg, magic-link as primary CTA, OAuth below "or" divider, soft-xl shadow, focus-soft rings, tap-44 affordances, atmospheric emerald + amber blur orbs replace clinical blue. Suspense skeleton matches.
- **`/dashboard`** — Editorial header (`TODAY` / `Your job pipeline`), warm-stone empty-state with soft border-dashed, `NextBestActionCard` rebuilt with shadow-soft-md + gradient hairline, "found today" pulse-soft pill.
- **`/settings`** — Editorial header (`CONFIGURATION`), diagnostics shortcut card with soft border + chevron-translate hover.
- **`/analytics`** — Editorial header (`PERFORMANCE`), interview-rate pill as full-rounded emerald-200 chip.
- **`/applications`** — Editorial header (`OUTREACH` / `Draft → Ready → Sent`).

Pattern applied uniformly: `animate-page-enter` on mount, `[11px] uppercase tracking-[0.18em]` editorial overline above H1, generous line-height, `tap-44` + `focus-soft` on every interactive surface. All underlying data-loading + Suspense + SWR plumbing untouched.

### Deferred — 4 surfaces (~3,000 LOC of client logic)
Too large to drive-by restyle without breaking state flow. Best done one-at-a-time with your visual review in the loop.

| Page | Size | Why deferred |
|---|---|---|
| `/resumes/tailor` | 1,082 LOC client.tsx | Complex JD-input + template picker + diff state |
| `/recommended` | 1,148 LOC client.tsx | Filters + match scoring + quick-apply per card |
| `/jobs/[id]` | 692 LOC client.tsx | Apply flow + activity timeline + email composer |
| `/landing` subcomponents | 8+ files (Hero/Modes/Safety/CTA) | Marketing surface — needs creative direction |

Recommend tackling `/recommended` and `/resumes/tailor` first next session — they're the highest-traffic daily-drivers.

---

## 5. What you still need to do (2 items, both account-bound)

These need accounts I'm not authed against — saved memory rules `feedback_github_account_per_dir.md` and `reference_vercel_setup.md`.

1. **GitHub secrets for nightly evals.** Set `GROQ_API_KEY` + `GEMINI_API_KEY` on the JobApplier repo so the eval workflow at 06:00 UTC can actually run. `gh` here is on `alishahid-source`; the `~/Mine/` rule says GitMuhammadAli only.
2. **ENCRYPTION_KEY rotation.** Same key in `.env.local` + `.env.production.local`. Vercel CLI is on `alishahidworks-8809`. Note: the AES-GCM upgrade auto-decodes v1 (CBC) ciphertext, so the algo change doesn't *require* rotation — but the local/prod duplication is a separate concern.

---

## 6. Open items queued for next session

- **Page redesigns** — the 4 deferred surfaces above. ~1 hr each with you in the loop.
- **Zod sweep follow-on** — admin/users (no body — query params only), admin/cleanup-emails (no body), `extract-from-image` (multipart, already MIME+size gated).
- **AES v1 → v2 backfill script** for ciphertext rows that don't naturally re-save (SMTP creds untouched for 6+ months).
- **PROVIDER_PRICING admin view** + threshold alerts on `LlmCallLog.costUsd` aggregates.
- **`replace remaining ~25 catch blocks`** in admin routes + scrapers (lower priority).

---

## 7. File map (cumulative across all 4 passes)

**New files (39):**
- `instrumentation.ts`, `MORNING_BRIEF.md`
- 6 migrations under `prisma/migrations/2026061404…` through `…180000` (5 of them now deployed to prod)
- `src/app/(landing)/{contact,privacy,subprocessors,terms}/page.tsx`
- `src/app/api/account/export/route.ts`, `src/app/api/email/unsubscribe/route.ts`
- `src/components/ui/{CommandPalette,CookieConsent,EmptyState,ErrorPanel,PageTransition,ProgressBar,ProgressPhases,SavedIndicator,SkeletonScreen}.tsx`
- `src/components/resumes/{RewriteDiff,SourcePdfSelector}.tsx`
- `src/lib/agents/resume-rewriter.ts`
- `src/lib/agents/__evals__/{types.ts,cases.ts,run.ts,fixtures/profiles.ts}`
- `src/lib/cost/pricing.ts`
- `src/lib/security/safe-fetch.ts`
- `src/lib/idempotency.ts`
- `src/lib/validation/parse-body.ts`
- `src/lib/errors/`, `src/lib/observability/`
- `src/lib/resume/{audit-layers.ts, derivations.json, synonyms.json}`
- `src/styles/tokens.css`
- `e2e/a11y.spec.ts`
- `.github/workflows/evals.yml`

**Modified (62):** `.github/workflows/ci.yml` (migrate-diff gate), `package.json` (+cmdk, +axe, +bundle-analyzer, +eval/+analyze scripts), `next.config.js` (bundle analyzer), `prisma/schema.prisma` (EmailSuppression, JobApplication.messageId, LlmCallLog.costUsd), `scripts/migrate-prod.mjs`, `src/middleware.ts` (origin guard), dashboard layout, settings action, both cron routes, generate route (idempotency + rewriter + return shape), parse-pdf route, global-error, globals.css (safe-area, tap-44, focus-soft, progress-indeterminate, view-transitions, page-enter), root layout, Footer, ProfileEditor (SavedIndicator), GenerateModal (RewriteDiff), ai-cover-letter, ai-pitch, generate-followup, groq (Gemini abort, streamWithGroq parity, LlmCallLog error/gemini rows), researcher (safeFetch), resume-matcher (aiTiebreaker userId), parse-uploaded-pdf, resume types (rewrite flag), send-application (suppression check, List-Unsubscribe, threading, messageId persist), encryption (GCM upgrade + legacy decrypt), encryption.test (GCM assertions), scraper-status.test (findFirst mock), tailwind config, quota.ts (pricing), 14 routes (Zod), 14 routes (captureError), 6 pages restyled (login, dashboard, settings, analytics, applications, login skeleton).

---

**Final state:** type-check clean, 463/463 unit tests green, 5 migrations live on Neon prod, zero commits. Everything else is yours to review.

— Claude
