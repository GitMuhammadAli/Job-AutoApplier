# JOBPILOT — SYSTEM ARCHITECTURE

> **Generated:** 2026-03-01 | **Single source of truth** for the entire application.
> **Last audit update:** Architecture rewrite with WHY rationale, production numbers, and updated references.

---

## QUICK REFERENCE (Part 13)

### What This App Does
JobPilot is an AI-powered job application automation platform. It scrapes jobs from 8 sources, matches them to users via a 7-factor scoring engine, generates personalized application emails using Groq AI, and sends them via user-configured SMTP — all orchestrated by cron jobs on a Kanban-style dashboard.

### Production Numbers (as of last audit)
| Metric | Value |
|--------|-------|
| Total GlobalJobs | 10,620 |
| Jobs with verified email | 103 (1.0%) |
| LinkedIn jobs | 8,857 (83%) — 0% have descriptions |
| Emails sent | 19 |
| Bounced | 0 |
| Delivery rate | 100% |
| Users | 4 |
| Source files | 120+ |
| API routes | 43 |
| Server actions | 40+ |

### Tech Stack
```
Frontend:  Next.js 14.2 App Router + Tailwind CSS + shadcn/ui + Zustand + SWR + Recharts
Backend:   API Routes + Server Actions + Prisma 5.20 + PostgreSQL (Neon)
AI:        Groq SDK (llama-3.1-8b-instant) + template fallback
Email:     Nodemailer 8.0 → Gmail / Outlook / Brevo / Custom SMTP
Auth:      NextAuth 4.24 (Google, GitHub, Email magic link) + custom admin auth
Deploy:    Vercel (Hobby plan, iad1 region) + Neon DB + Vercel Blob
Crons:     cron-job.org (external HTTP GET) — vercel.json has no crons (Hobby plan limitation)
```

### Complete Pipeline
Jobs are scraped from LinkedIn, Indeed, Remotive, Arbeitnow, Adzuna, Rozee, JSearch, and Google Jobs into `GlobalJob`. Match crons score jobs against user keywords/skills/location and create `UserJob` records. The instant-apply cron generates AI emails for high-scoring matches and creates `JobApplication` records (DRAFT or READY). The send-queued cron picks up READY applications and sends them via Nodemailer, transitioning status to SENT/FAILED/BOUNCED. Follow-up crons flag ghosted applications after 14 days. Users track everything on a drag-and-drop Kanban board.

### All Pages
```
/                         → Landing page (public)                    [Server Component]
/login                    → User login (public)                      [Server + Client]
/admin/login              → Admin login (public)                     [Client Component]
/dashboard                → Kanban board + status (protected)        [Server Component]
/dashboard/jobs/new       → Add manual job (protected)               [Server Component]
/dashboard/jobs/[id]      → Job detail + apply panel (protected)     [Server + Client]
/dashboard/recommended    → AI-recommended jobs (protected)          [Server + Client]
/dashboard/applications   → Email queue manager (protected)          [Server + Client]
/dashboard/resumes        → Resume manager (protected)               [Server + Client]
/dashboard/templates      → Email template editor (protected)        [Server + Client]
/dashboard/analytics      → Charts + stats (protected)               [Server + Client]
/dashboard/settings       → User settings (protected)                [Server + Client]
/dashboard/system-health  → System monitor (protected)               [Client Component]
/admin                    → Admin dashboard (admin)                  [Client Component]
/admin/users              → User management (admin)                  [Client Component]
/admin/scrapers           → Scraper health (admin)                   [Client Component]
/admin/logs               → System logs (admin)                      [Client Component]
/admin/feedback           → User feedback (admin)                    [Client Component]
```

### All API Routes
```
| Path                              | Methods   | Auth            | Purpose                          |
|-----------------------------------|-----------|-----------------|----------------------------------|
| /api/auth/[...nextauth]           | GET,POST  | NextAuth        | OAuth + magic link               |
| /api/admin/auth                   | POST,DEL  | Credentials     | Admin login/logout               |
| /api/admin/backfill-emails        | POST      | requireAdmin    | Extract emails from descriptions |
| /api/admin/cleanup-matches        | POST      | requireAdmin    | Rescore and cleanup matches      |
| /api/admin/feedback               | GET,PATCH | requireAdmin    | View/manage user feedback        |
| /api/admin/jobs                   | DELETE    | requireAdmin    | Clear inactive/old/no-email jobs |
| /api/admin/logs                   | GET       | requireAdmin    | System log viewer                |
| /api/admin/quotas                 | GET       | requireAdmin    | API quota usage                  |
| /api/admin/scrapers               | GET       | requireAdmin    | Scraper health status            |
| /api/admin/scrapers/trigger       | POST      | requireAdmin    | Manual scraper/cron trigger      |
| /api/admin/stats                  | GET       | requireAdmin    | Admin dashboard stats            |
| /api/admin/users                  | GET       | requireAdmin    | List users                       |
| /api/admin/users/[id]             | PATCH,DEL | requireAdmin    | Pause/activate/delete user       |
| /api/analytics                    | GET       | getAuthUserId   | User analytics summary           |
| /api/applications/generate        | POST      | getAuthUserId   | AI email generation              |
| /api/applications/bulk-send       | POST      | getAuthUserId   | Bulk send (max 3/req, quality filtered + deduped) |
| /api/applications/[id]/send       | POST      | getAuthUserId   | Send single application          |
| /api/applications/send-stats      | GET       | getAuthUserId   | Rate limit stats                 |
| /api/email/test                   | POST      | getAuthUserId   | Test SMTP configuration          |
| /api/export                       | GET       | getAuthUserId   | Export user data as ZIP          |
| /api/health                       | GET       | None (public)   | Public health check              |
| /api/heartbeat                    | POST      | getAuthUserId   | Update lastVisitedAt             |
| /api/jobs/scan-now                | POST      | getAuthUserId   | On-demand job scan               |
| /api/jobs/extract-url             | POST      | getAuthUserId   | Extract job from URL             |
| /api/jobs/generate-pitch          | POST      | getAuthUserId   | AI pitch generation              |
| /api/onboarding/complete          | POST      | getAuthUserId   | Complete onboarding + match      |
| /api/resumes/upload               | POST      | getAuthUserId   | Upload resume PDF                |
| /api/resumes/[id]/preview         | GET       | getAuthUserId   | Stream resume file               |
| /api/settings/mode                | GET       | getAuthUserId   | Get application mode             |
| /api/settings/status              | PATCH     | getAuthUserId   | Toggle active/paused             |
| /api/status                       | GET       | getAuthUserId   | Dashboard status bar             |
| /api/system-health                | GET       | getAuthSession  | System health (admin detail)     |
| /api/version                      | GET       | None (public)   | Build ID                         |
| /api/webhooks/email-bounce        | POST      | HMAC signature  | Brevo bounce handler             |
| /api/cron/scrape-global           | GET       | verifyCronSecret| Multi-source scraper             |
| /api/cron/scrape/[source]         | GET       | verifyCronSecret| Single-source scraper            |
| /api/cron/match-jobs              | GET       | verifyCronSecret| Match recent jobs (24h)          |
| /api/cron/match-all-users         | GET       | verifyCronSecret| Match unmatched jobs (userJobs: none) |
| /api/cron/instant-apply           | GET       | verifyCronSecret| Auto-draft/send applications     |
| /api/cron/send-queued             | GET       | verifyCronSecret| Send READY apps (no schedule)    |
| /api/cron/send-scheduled          | GET       | verifyCronSecret| Send scheduled apps (separate from send-queued) |
| /api/cron/notify-matches          | GET       | verifyCronSecret| Email users about matches        |
| /api/cron/follow-up               | GET       | verifyCronSecret| Mark ghosted + flag follow-ups   |
| /api/cron/check-follow-ups        | GET       | verifyCronSecret| Generate follow-up drafts        |
| /api/cron/cleanup-stale           | GET       | verifyCronSecret| Deactivate old jobs + cleanup    |
```

### All Cron Jobs (10 total, all on cron-job.org)
```
| Name                | Route                                        | Schedule          | What It Does                                       |
|---------------------|----------------------------------------------|-------------------|----------------------------------------------------|
| Scrape Global (free)| /api/cron/scrape-global?mode=free&match=true | 0 */2 * * *       | LinkedIn, LinkedIn Posts, Remotive, Arbeitnow       |
| Scrape Global (paid)| /api/cron/scrape-global?mode=paid&match=false| 0 6 * * *         | JSearch, Indeed, Adzuna, Google Jobs, Rozee          |
| Match All Users     | /api/cron/match-all-users                    | 0 * * * *         | Score jobs not yet matched to any user (userJobs: none); workload constant regardless of DB size |
| Instant Apply       | /api/cron/instant-apply                      | */30 * * * *      | Create drafts for matched jobs with verified emails  |
| Send Queued         | /api/cron/send-queued                        | */5 * * * *       | Send READY applications (no schedule)                |
| Send Scheduled      | /api/cron/send-scheduled                     | */5 * * * *       | Send scheduled applications past their send time     |
| Notify Matches      | /api/cron/notify-matches                     | 0 9 * * *         | Email users about new matched jobs                   |
| Follow Up           | /api/cron/follow-up                          | 0 10 * * *        | Mark ghosted + flag follow-up reminders              |
| Check Follow-ups    | /api/cron/check-follow-ups                   | 0 9 * * *         | Generate follow-up drafts for flagged jobs            |
| Cleanup Stale       | /api/cron/cleanup-stale                      | 0 3 * * *         | Deactivate old unseen jobs; 2-phase URL check (HEAD + position-filled text scan, up to 5 pages/run) |
```
**NOTE:** vercel.json has NO crons configured — all scheduling is via cron-job.org (Vercel Hobby plan limitation).

**FREE/PAID SPLIT:** Indeed and Rozee use paid API keys (RapidAPI and SerpAPI respectively) despite appearing "free" — they are correctly categorized as paid sources in `source-rotation.ts` to prevent quota exhaustion.

**Fire-and-forget chaining:** After scrape-global completes, it triggers instant-apply automatically. After match-all-users finds matches, it triggers notify-matches and instant-apply. Maintenance crons (cleanup-stale, check-follow-ups) are triggered by scrape-global only if last run was >20 hours ago.

**Admin triggers (scrapers/trigger):** scrape-global, backfill-emails, instant-apply, match-jobs, match-all-users, send-scheduled, send-queued, notify-matches, cleanup-stale, follow-up, check-follow-ups.

**cleanup-stale position-filled detection:** 2-phase URL check — Phase 1: HEAD requests (existing). Phase 2: fetch pages that returned 200, check for "position filled" / "job expired" / "no longer accepting" text in first 10KB. Up to 5 pages per run, 3s timeout.

### All Server Actions (src/app/actions/)
```
| Function                      | File                    | Purpose                              |
|-------------------------------|-------------------------|--------------------------------------|
| getAnalytics()                | analytics.ts            | Comprehensive user analytics         |
| getDeliveryStats()            | analytics.ts            | Email delivery rates                 |
| generateApplication()         | application-email.ts    | AI email draft generation            |
| updateApplicationDraft()      | application-email.ts    | Update draft fields                  |
| generateCoverLetterAction()   | application-email.ts    | AI cover letter                      |
| markAsManuallyApplied()       | application-email.ts    | Mark platform-applied                |
| getApplications()             | application.ts          | List user applications               |
| getApplicationCounts()        | application.ts          | Status counts                        |
| prepareApplication()          | application.ts          | Create/update application draft      |
| markApplicationReady()        | application.ts          | DRAFT → READY                        |
| cancelApplication()           | application.ts          | Cancel pending application           |
| bulkMarkReady()               | application.ts          | Bulk DRAFT → READY                   |
| startFresh()                  | application.ts          | Delete all apps + jobs               |
| generateCoverLetter()         | cover-letter.ts         | AI cover letter via Groq             |
| saveCoverLetter()             | cover-letter.ts         | Save to UserJob                      |
| getEmailTemplates()           | email-template.ts       | List templates                       |
| createEmailTemplate()         | email-template.ts       | New template with default handling   |
| updateEmailTemplate()         | email-template.ts       | Edit template                        |
| deleteEmailTemplate()         | email-template.ts       | Remove template                      |
| seedStarterTemplates()        | email-template.ts       | Create 4 starter templates           |
| submitFeedback()              | feedback.ts             | User bug/suggestion report           |
| getJobs()                     | job.ts                  | Kanban board jobs                    |
| getJobById()                  | job.ts                  | Job detail with relations            |
| updateStage()                 | job.ts                  | Move job between stages              |
| dismissJob()                  | job.ts                  | Dismiss with reason                  |
| addNote()                     | job.ts                  | Add/update job note                  |
| toggleBookmark()              | job.ts                  | Bookmark toggle                      |
| createManualJob()             | job.ts                  | Manual job entry                     |
| saveGlobalJob()               | job.ts                  | Save recommended job                 |
| dismissGlobalJob()            | job.ts                  | Dismiss recommended job              |
| bulkDismissJobs()             | job.ts                  | Bulk dismiss (max 500)               |
| getTodaysQueue()              | job.ts                  | Top 15 daily jobs                    |
| markAppliedFromSite()         | job.ts                  | Track platform application           |
| getResumesWithStats()         | resume.ts               | Resume listing (no content)          |
| createResume()                | resume.ts               | New resume record                    |
| updateResume()                | resume.ts               | Edit resume metadata                 |
| deleteResume()                | resume.ts               | Soft delete (can't delete last)      |
| reExtractResume()             | resume.ts               | Re-parse PDF text                    |
| rephraseResumeContent()       | resume.ts               | AI resume improvement                |
| getSettings()                 | settings.ts             | Decrypted user settings (cached)     |
| getSettingsLite()             | settings.ts             | Lightweight settings (no decrypt)    |
| saveSettings()                | settings.ts             | Update with encryption + validation  |
| completeOnboarding()          | settings.ts             | Mark isOnboarded = true              |
| deleteAccount()               | settings.ts             | Cascading account deletion           |
```

### All Context Providers
```
| Provider        | File                                | Provides          | Wraps        |
|-----------------|-------------------------------------|--------------------|--------------|
| SessionProvider | components/auth/SessionProvider.tsx  | NextAuth session   | Root layout  |
| ThemeProvider   | components/providers/ThemeProvider.tsx| theme, setTheme   | Root layout  |
```

### All Zustand Stores
```
| Store            | File                      | Provides                                  |
|------------------|---------------------------|-------------------------------------------|
| useJobStore      | store/useJobStore.ts      | jobs, filter, search, stage management     |
| useSidebarStore  | store/useSidebarStore.ts  | collapsed, mobileOpen                      |
```

### All Environment Variables
```
| Variable              | Purpose                    | Required | Default              |
|-----------------------|----------------------------|----------|----------------------|
| DATABASE_URL          | Neon PostgreSQL connection  | YES      | —                    |
| NEXTAUTH_URL          | Auth base URL              | YES      | —                    |
| NEXTAUTH_SECRET       | Session encryption         | YES      | —                    |
| NEXT_PUBLIC_APP_URL   | Public app URL (client)    | YES      | localhost:3000       |
| GOOGLE_CLIENT_ID      | OAuth provider             | NO       | —                    |
| GOOGLE_CLIENT_SECRET  | OAuth provider             | NO       | —                    |
| GITHUB_CLIENT_ID      | OAuth provider             | NO       | —                    |
| GITHUB_CLIENT_SECRET  | OAuth provider             | NO       | —                    |
| SMTP_HOST             | System email host          | NO       | smtp-relay.brevo.com |
| SMTP_PORT             | System email port          | NO       | 587                  |
| SMTP_USER             | System email user          | NO       | —                    |
| SMTP_PASS             | System email password      | NO       | —                    |
| NOTIFICATION_EMAIL    | System notification sender | NO       | —                    |
| GROQ_API_KEY          | AI email generation        | NO       | —                    |
| CRON_SECRET           | Cron job authentication    | YES      | —                    |
| ENCRYPTION_KEY        | AES-256 for PII fields     | YES      | —                    |
| RAPIDAPI_KEY          | JSearch scraper            | NO       | —                    |
| ADZUNA_APP_ID         | Adzuna scraper             | NO       | —                    |
| ADZUNA_APP_KEY        | Adzuna scraper             | NO       | —                    |
| ADZUNA_COUNTRY        | Adzuna country filter      | NO       | us                   |
| SERPAPI_KEY            | Google Jobs scraper        | NO       | —                    |
| GOOGLE_CSE_KEY        | Google Custom Search API   | NO       | —                    |
| GOOGLE_CSE_ID         | Google CSE engine ID       | NO       | —                    |
| BLOB_READ_WRITE_TOKEN | Vercel Blob storage        | NO       | —                    |
| BREVO_WEBHOOK_SECRET  | Bounce webhook HMAC        | NO       | —                    |
| ADMIN_EMAILS          | OAuth admin whitelist      | NO       | —                    |
| ADMIN_USERNAME        | Admin panel credentials    | NO       | —                    |
| ADMIN_PASSWORD        | Admin panel credentials    | NO       | —                    |
| ALERT_DISCORD_WEBHOOK | Discord failure alerts     | NO       | —                    |
| ALERT_WEBHOOK_URL     | Generic webhook alerts     | NO       | —                    |
```

### Top 10 Critical Issues (Status: Most Fixed)
1. ~~`send-queued` and `send-scheduled` share lock~~ — **FIXED**: separate lock names
2. ~~Applications created with `recipientEmail: ""`~~ — **FIXED**: `markApplicationReady()` validates fields; `bulkMarkReady()` filters empty
3. ~~Resume download failure sends email without attachment~~ — **FIXED**: returns app to READY for retry
4. `maxDuration: 60` ignored on Hobby plan (10s limit) — functions use soft timeout (8s) to exit gracefully
5. ~~Duplicate `checkNotificationLimit` implementations~~ — **FIXED**: single `canSendNotification()` + `claimNotificationSlot()`
6. ~~Malformed JSON in subject/body sent as-is~~ — **FIXED**: `cleanJsonField()` strips corrupted JSON
7. ~~No validation of subject/body before sending~~ — **FIXED**: `send-application.ts` validates non-empty subject/body
8. CRON_SECRET in query params — logged in server access logs (by design for cron-job.org; also supports header auth)
9. `resumeMatchMode` setting saved but never used — UI lies to user (dead setting)
10. ~~7 `.catch(() => {})` patterns swallow errors silently~~ — **FIXED**: all silent catches now log with context

### New/Updated Files (Architecture Doc v2)
| File | Purpose |
|------|---------|
| `src/lib/extract-email-from-text.ts` | Standalone email extraction from text; scoring by prefix patterns (HIRING_PREFIXES +10, PERSONAL_PATTERN -10); 85-95 confidence |
| `src/lib/cron-tracker.ts` | Cron outcome logging: success/error/skipped → SystemLog; retry on DB failure |
| `src/components/jobs/FreshnessIndicator.tsx` | Job freshness badge (Fresh / Xd ago / may be filled / likely expired) + FreshnessDot |
| `src/app/api/admin/backfill-emails/route.ts` | Admin endpoint: extract emails from job descriptions; fix legacy emails with null confidence |
| `src/lib/scrapers/post-scrape-enrichment.ts` | Company email cache (persistent CompanyEmail table) + cross-source dedup |
| `src/lib/scrapers/keyword-aggregator.ts` | Enhanced with ROI-weighted keyword selection for paid mode |

### File Count Summary
```
Total source files:    ~120+
Server Components:     15 (page.tsx + layout.tsx)
Client Components:     55+ (components/ + client pages)
API Routes:            43
Server Actions:        40+ functions across 9 files
Zustand Stores:        2
Lib/Utility files:     30+
UI Components:         20 (shadcn/ui)
Loading skeletons:     11
Error boundaries:      10
```

---

# PART 1: PROJECT OVERVIEW

## 1.0 Architectural Rationale (WHY)

**WHY App Router over Pages Router:** Server Components ship 0 client JS for data-fetching pages — the dashboard fetches 4 data sources in parallel on the server and ships pre-rendered HTML. Server Actions eliminate API route boilerplate for mutations (forms, stage changes, settings). No need for separate `/api/` endpoints for every user action.

**WHY monolithic Next.js instead of separate frontend/backend:** Single deployment, shared TypeScript types, no API versioning headaches. Vercel handles both frontend and API routes in one project. One `prisma generate` and one `npm run build`.

**WHY Vercel Hobby plan constraints shape everything:** 10s function timeout (not 60s) = 8s soft limit for crons. Scraper parallelization is tuned to finish within 8s. Fire-and-forget chaining: scrape-global doesn't wait for match-jobs — each cron is invoked separately by cron-job.org. Cold starts add 1-3s; first request after idle is slow.

## 1.1 Tech Stack

| Technology | Version | Role |
|-----------|---------|------|
| Next.js | 14.2.0 | App Router framework |
| React | 18.3.0 | UI library |
| TypeScript | 5.5.0 | Type safety, strict mode |
| Prisma | 5.20.0 | ORM + migrations |
| PostgreSQL | — | Database (Neon, connection pooling) |
| Tailwind CSS | 3.4.0 | Utility-first styling |
| shadcn/ui | — | Radix-based UI primitives (new-york style) |
| NextAuth | 4.24.13 | Auth (Google, GitHub, Email) |
| Groq SDK | 0.37.0 | AI email generation (llama-3.1-8b-instant) |
| Nodemailer | 8.0.1 | SMTP email sending |
| Vercel Blob | — | Resume file storage |
| Zustand | 4.5.0 | Client state (jobs, sidebar) |
| SWR | 2.4.0 | Client data fetching (StatusBanner) |
| Zod | 3.23.0 | Schema validation (settings, forms) |
| Recharts | — | Analytics charts |
| @dnd-kit | — | Kanban drag-and-drop |
| Sonner | — | Toast notifications |
| Lucide React | — | Icons |
| date-fns | — | Date formatting |
| Framer Motion | — | Animations (landing page) |
| pdf-parse + unpdf + pdfjs-dist | — | Resume PDF text extraction |
| mammoth | — | DOCX support |
| Playwright | 1.58.2 | E2E testing |

**All package.json dependencies:**
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — drag-and-drop
- `@next-auth/prisma-adapter` — NextAuth ↔ Prisma bridge
- `@prisma/client` — DB client
- `@radix-ui/*` (dialog, dropdown, label, popover, select, separator, slot, switch, tabs, tooltip) — headless UI primitives
- `@vercel/blob` — file storage
- `class-variance-authority` — component variants
- `clsx` — conditional classes
- `cmdk` — command palette
- `framer-motion` — animations
- `jszip` — ZIP export
- `next-themes` — (imported but custom ThemeProvider used)
- `react-day-picker` — calendar picker
- `tailwind-merge` — merge Tailwind classes
- `tailwindcss-animate` — animation plugin

## 1.2 Project Structure

```
root/
├── prisma/
│   ├── schema.prisma            → 15 models, 4 enums, 20+ indexes
│   └── seed.ts                  → Demo user + 8 resumes
├── public/                      → Static assets (icons, images)
├── src/
│   ├── app/
│   │   ├── layout.tsx           → Root layout [Server] — providers, fonts, toaster
│   │   ├── not-found.tsx        → 404 page [Server]
│   │   ├── manifest.ts          → PWA manifest with share target
│   │   ├── globals.css          → Tailwind directives + CSS variables
│   │   ├── (landing)/           → Public landing page
│   │   │   ├── layout.tsx       → Landing SEO metadata [Server]
│   │   │   └── page.tsx         → Hero, features, CTA [Server]
│   │   ├── login/
│   │   │   ├── page.tsx         → Login wrapper [Server]
│   │   │   └── LoginForm.tsx    → OAuth + magic link [Client]
│   │   ├── (dashboard)/         → Protected user pages
│   │   │   ├── layout.tsx       → Auth check + sidebar + header [Server]
│   │   │   ├── dashboard/page.tsx → Kanban + status [Server]
│   │   │   ├── jobs/new/page.tsx  → Manual job form [Server]
│   │   │   ├── jobs/[id]/        → Job detail
│   │   │   │   ├── page.tsx      → Data fetch [Server]
│   │   │   │   └── client.tsx    → Interactive detail [Client]
│   │   │   ├── recommended/page.tsx → AI recommendations [Server]
│   │   │   ├── applications/page.tsx → Email queue [Server]
│   │   │   ├── resumes/page.tsx     → Resume manager [Server]
│   │   │   ├── templates/page.tsx   → Email templates [Server]
│   │   │   ├── analytics/page.tsx   → Charts + stats [Server]
│   │   │   ├── settings/page.tsx    → User config [Server]
│   │   │   └── system-health/page.tsx → Monitor [Client]
│   │   ├── (admin)/              → Admin pages (all Client components)
│   │   │   ├── layout.tsx        → Admin auth + sidebar [Server]
│   │   │   └── admin/
│   │   │       ├── page.tsx      → Admin dashboard
│   │   │       ├── users/page.tsx
│   │   │       ├── scrapers/page.tsx
│   │   │       ├── logs/page.tsx
│   │   │       └── feedback/page.tsx
│   │   ├── (admin-auth)/admin/login/page.tsx → Admin login [Client]
│   │   ├── actions/              → Server Actions (9 files, 40+ functions)
│   │   │   ├── analytics.ts
│   │   │   ├── application-email.ts
│   │   │   ├── application.ts
│   │   │   ├── cover-letter.ts
│   │   │   ├── email-template.ts
│   │   │   ├── feedback.ts
│   │   │   ├── job.ts
│   │   │   ├── resume.ts
│   │   │   └── settings.ts
│   │   └── api/                  → API Routes (43 route.ts files)
│   │       ├── auth/[...nextauth]/
│   │       ├── admin/ (11 routes)
│   │       ├── applications/ (4 routes)
│   │       ├── cron/ (11 routes)
│   │       ├── webhooks/email-bounce/
│   │       └── (analytics, email, export, health, heartbeat, jobs, onboarding,
│   │            resumes, settings, status, system-health, version)
│   ├── components/
│   │   ├── ui/ (20 shadcn/ui primitives)
│   │   ├── analytics/ (Charts, StatsBar, SpeedMetrics, WeeklyComparison, KeywordEffectiveness)
│   │   ├── applications/ (ApplicationQueue, CopyApplicationBundle, SendingStatusBar)
│   │   ├── jobs/ (JobForm, QuickApplyPanel, QuickApplyKit, ActivityTimeline, FreshnessIndicator)
│   │   ├── auth/ (SessionProvider)
│   │   ├── dashboard/ (BulkActionsBar, DeliveryStats, StatusBanner, TodaysQueue)
│   │   ├── kanban/ (KanbanBoard, KanbanColumn, JobCard)
│   │   ├── landing/ (13 components: Hero, Features, Navbar, Footer, etc.)
│   │   ├── layout/ (Sidebar, Header, DashboardShell, UpdateBanner)
│   │   ├── onboarding/ (OnboardingWizard)
│   │   ├── providers/ (ThemeProvider)
│   │   ├── resumes/ (ResumeList)
│   │   ├── settings/ (SettingsForm)
│   │   ├── shared/ (12 components: Skeletons, FeedbackWidget, ThemeToggle, etc.)
│   │   └── templates/ (TemplateEditor)
│   ├── lib/                      → Server utilities (30+ files)
│   │   ├── prisma.ts             → Singleton Prisma client
│   │   ├── auth.ts               → NextAuth config + helpers
│   │   ├── admin.ts + admin-auth.ts → Admin auth system
│   │   ├── encryption.ts         → AES-256-CBC for PII
│   │   ├── constants.ts          → LIMITS, TIMEOUTS, MATCHING, STALE_DAYS
│   │   ├── cron-auth.ts          → verifyCronSecret()
│   │   ├── groq.ts               → Groq API wrapper with retry
│   │   ├── ai-email-generator.ts → Email generation + JSON parsing
│   │   ├── ai-cover-letter-generator.ts → Cover letter generation
│   │   ├── ai-fallback.ts        → Template fallback when AI fails
│   │   ├── email.ts              → Nodemailer transporters + HTML formatting
│   │   ├── email-errors.ts       → SMTP error classification
│   │   ├── extract-email-from-text.ts → Standalone email extraction from text (scoring by prefix patterns)
│   │   ├── email-extractor.ts    → 3-strategy company email finder
│   │   ├── email-verifier.ts     → MX record verification + cache
│   │   ├── email-templates.ts    → HTML notification templates (lazy getAppUrl())
│   │   ├── send-application.ts   → Core email send logic (decryption failure detection)
│   │   ├── send-limiter.ts       → Rate limiting + warmup + bounce pause
│   │   ├── system-lock.ts        → Distributed lock for crons (try/catch on acquire)
│   │   ├── duplicate-checker.ts  → 7-day dedup by company+title
│   │   ├── readiness-checker.ts  → Onboarding readiness validation
│   │   ├── notifications.ts      → Send notification emails
│   │   ├── notification-limiter.ts → Notification frequency control
│   │   ├── rate-limit.ts         → Per-user action rate limiting
│   │   ├── cron-tracker.ts       → Cron run tracking (success/error/skipped → SystemLog)
│   │   ├── webhooks.ts           → Discord/Telegram alert webhooks
│   │   ├── api-response.ts       → API response helpers
│   │   ├── utils.ts              → cn(), stage config, daysAgo()
│   │   ├── job-categorizer.ts    → 28-category classifier
│   │   ├── skill-extractor.ts    → Resume skill detection
│   │   ├── resume-parser.ts      → PDF text extraction (3 methods)
│   │   ├── matching/
│   │   │   ├── score-engine.ts   → 7-factor scoring (1000+ lines)
│   │   │   ├── resume-matcher.ts → 4-tier resume selection + AI
│   │   │   ├── recommendation-engine.ts → Query-time job recommendations
│   │   │   └── location-filter.ts → Location/platform filters
│   │   ├── scrapers/
│   │   │   ├── index.ts          → Scraper registry
│   │   │   ├── scraper-runner.ts → Orchestration + dedup (8s default timeout, fallback budget guard)
│   │   │   ├── fetch-with-retry.ts → HTTP retry logic
│   │   │   ├── source-rotation.ts → Load balancing
│   │   │   ├── keyword-aggregator.ts → Search query builder
│   │   │   ├── jsearch.ts, adzuna.ts, google-jobs.ts, indeed.ts
│   │   │   ├── linkedin.ts, remotive.ts, rozee.ts, arbeitnow.ts
│   │   │   └── google-hiring-posts.ts
│   │   └── email/
│   │       └── notifications.ts  → Email notification limits
│   ├── store/
│   │   ├── useJobStore.ts        → Zustand job pipeline state
│   │   └── useSidebarStore.ts    → Zustand sidebar UI state
│   ├── types/
│   │   ├── index.ts              → All app types/interfaces
│   │   └── next-auth.d.ts        → Session type extension
│   ├── constants/
│   │   └── skills.ts             → SKILL_ALIASES map
│   └── middleware.ts             → Rate limiting for API routes
├── package.json
├── next.config.js
├── vercel.json
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── .eslintrc.json
└── components.json               → shadcn/ui config
```

## 1.3 Environment Variables

See Quick Reference section above for complete table.

## 1.4 Configuration Files

**next.config.js:**
- `reactStrictMode: true`, `compress: true`
- Webpack: `canvas` alias → false (PDF.js compat)
- Server external packages: `pdf-parse`, `pdfjs-dist`
- `optimizePackageImports`: lucide-react, @radix-ui/*, date-fns, recharts, swr
- Security headers: X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy
- Remote image patterns: `googleusercontent.com`, `githubusercontent.com`
- Server Actions allowedOrigins from `NEXT_PUBLIC_APP_URL`

**vercel.json:**
- Region: `iad1`
- No crons configured — all cron scheduling via cron-job.org

**tailwind.config.ts:**
- Dark mode: `class` strategy
- HSL CSS variables for colors
- Extended borderRadius via `--radius` variable
- Plugin: `tailwindcss-animate`

**tsconfig.json:**
- `strict: true`, `noEmit: true`
- Path alias: `@/*` → `./src/*`

**.eslintrc.json:**
- Extends: `next/core-web-vitals`

**postcss.config.js:**
- Tailwind CSS + Autoprefixer

---

# PART 2: DATABASE SCHEMA

## 2.0 Database Rationale (WHY)

**WHY these specific indexes:** Composite indexes on `(userId, stage)`, `(userId, isDismissed)`, `(isActive, source)` match exact query patterns. Kanban loads jobs by userId + stage. Recommended page filters by isDismissed. Scraper health groups by source + isActive. Without these, every list query would full-scan.

**WHY GlobalJob is shared (no userId):** Same job scraped for 20 users is stored once, not 20 times. Avoids duplicate data, reduces storage, and ensures one source of truth for companyEmail, description, skills. UserJob is the per-user view (stage, score, notes).

**WHY isFresh exists:** Without it, the matching cron would re-score all 10,620 jobs every run. With isFresh, only new jobs (just scraped) get matched. After instant-apply processes a job, isFresh is set to false. Massive performance win.

**WHY String[] for skills (not JSON):** Prisma supports PostgreSQL native arrays. `skills String[]` maps to `text[]` — no JSON parsing, efficient indexing. Simple string lists don't need junction tables. (Note: some code may cast when skills come from API responses.)

## 2.1 Complete Schema

### MODEL: User
Purpose: NextAuth user record — the root entity.
```
Fields:
  id             String     @id @default(cuid())    — Primary key
  name           String?                             — Display name
  email          String?    @unique                  — Email address
  emailVerified  DateTime?                           — Email verification date
  image          String?                             — Avatar URL
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
Relations:
  hasMany Account, Session, UserJob, Resume, Activity, JobApplication, UserFeedback
  hasOne  UserSettings
```

### MODEL: Account
Purpose: OAuth provider link (Google, GitHub).
```
Fields:
  id, userId, type, provider, providerAccountId, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state
Relations: belongsTo User via userId
Unique: @@unique([provider, providerAccountId])
Index: @@index([userId])
```

### MODEL: Session
Purpose: Database-backed session token.
```
Fields: id, sessionToken @unique, userId, expires
Relations: belongsTo User
Index: @@index([userId])
```

### MODEL: VerificationToken
Purpose: Email magic link tokens.
```
Unique: @@unique([identifier, token])
```

### MODEL: GlobalJob
Purpose: Shared scraped job — one per job across all users.
```
Fields:
  id               String    @id @default(cuid())
  title            String                            — Job title
  company          String                            — Company name
  location         String?                           — Location text
  description      String?   @db.Text                — Full description
  salary           String?                           — Salary text
  jobType          String?                           — Full-time/Part-time
  experienceLevel  String?                           — Senior/Mid/Entry
  category         String?                           — Auto-categorized
  skills           String[]                          — Required skills (PostgreSQL native array)
  postedDate       DateTime?                         — Original post date
  expiryDate       DateTime?                         — Expiry date
  source           String                            — linkedin/indeed/etc
  sourceId         String                            — External ID
  sourceUrl        String?                           — Original listing URL
  applyUrl         String?                           — Application URL
  companyUrl       String?                           — Company website
  companyEmail     String?                           — Found email
  emailSource      String?                           — How email was found
  emailConfidence  Int?                              — Confidence score 0-100
  emailContributedBy String?                         — Who found email
  isActive         Boolean   @default(true)          — Not stale
  isFresh          Boolean   @default(true)          — Not yet processed
  firstSeenAt      DateTime  @default(now())
  lastSeenAt       DateTime  @default(now())
Relations: hasMany UserJob
Unique: @@unique([sourceId, source])
Indexes: source, [source,isActive], category, [isActive,createdAt], [isFresh,isActive], createdAt
```

### MODEL: CompanyEmail
Purpose: Persistent company email cache — survives redeployments. Once an email is found for a company, it's stored permanently and reused for all future jobs from that company.
```
Fields:
  id             String   @id @default(cuid())
  companyNorm    String   @unique              — Normalized company name (lowercase, alphanumeric only)
  companyDisplay String                        — Original company name for display
  email          String                        — Cached email address
  confidence     Int                           — Email confidence score (0-100)
  source         String                        — How email was found (description_text, careers_page, etc.)
  lastVerifiedAt DateTime @default(now())      — Last time this email was verified
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
Indexes: companyNorm
```

### MODEL: UserJob
Purpose: Per-user view of a job — tracks stage, score, notes, bookmarks.
```
Fields:
  id             String      @id @default(cuid())
  userId         String
  globalJobId    String
  stage          JobStage    @default(SAVED)         — Kanban column
  matchScore     Float?                              — 0-100 match score
  matchReasons   String[]                            — Why it matched
  notes          String?     @db.Text                — User notes
  coverLetter    String?     @db.Text                — Generated cover letter
  isBookmarked   Boolean     @default(false)
  isDismissed    Boolean     @default(false)
  dismissReason  String?
  lastFollowUpAt DateTime?
  followUpCount  Int         @default(0)
Relations: belongsTo User, GlobalJob; hasOne JobApplication; hasMany Activity
Unique: @@unique([userId, globalJobId])
Indexes: [userId,stage], [userId,matchScore], [userId,isDismissed], [userId,createdAt]
```

### MODEL: Resume
Purpose: User resume file with extracted text and skills.
```
Fields:
  id, userId, name, fileName, fileUrl, fileType
  content          String?   @db.Text                — Extracted text
  textQuality      String?   @default("good")        — good/poor/empty
  targetCategories String[]                           — Job categories
  detectedSkills   String[]                           — Auto-extracted skills
  isDefault        Boolean   @default(false)
  isDeleted        Boolean   @default(false)
  deletedAt        DateTime?
Relations: belongsTo User; hasMany JobApplication
Indexes: [userId], [userId,isDeleted]
```

### MODEL: UserSettings
Purpose: 50+ user preferences — personal info, job prefs, automation, SMTP, AI.
```
Key Fields:
  Personal:      fullName, phone, linkedinUrl, portfolioUrl, githubUrl
  Job Prefs:     keywords[], negativeKeywords[], city, country, salaryMin/Max, salaryCurrency,
                 experienceLevel, education, workType[], jobType[], languages[],
                 preferredCategories[], preferredPlatforms[]
  Notifications: emailNotifications, notificationEmail, notificationFrequency
  Email:         emailProvider, smtpHost, smtpPort, smtpUser, smtpPass
  Automation:    applicationEmail, applicationMode (enum), autoApplyEnabled, instantApplyEnabled,
                 maxAutoApplyPerDay, minMatchScoreForAutoApply, defaultSignature, peakHoursOnly, timezone
  AI:            customSystemPrompt, preferredTone, emailLanguage, includeLinkedin/Github/Portfolio, customClosing
  Safety:        sendDelaySeconds, maxSendsPerHour, maxSendsPerDay, cooldownMinutes, bouncePauseHours,
                 sendingPausedUntil, smtpVerifiedAt, smtpSetupDate
  Other:         accountStatus, blacklistedCompanies[], resumeMatchMode, priorityPlatforms[],
                 lastVisitedAt, isOnboarded
Relations: belongsTo User; hasMany EmailTemplate
Unique: userId
```

### MODEL: EmailTemplate
Purpose: Custom email templates per user.
```
Fields: id, userId, settingsId, name, subject, body @db.Text, isDefault
Indexes: [userId], [userId,isDefault]
```

### MODEL: JobApplication
Purpose: Sent application record — email content, status, SMTP metadata.
```
Fields:
  id, userJobId @unique, userId
  senderEmail, recipientEmail, subject, emailBody @db.Text
  resumeId, coverLetter @db.Text, templateId
  status           ApplicationStatus @default(DRAFT)
  sentAt           DateTime?
  errorMessage     String?
  retryCount       Int         @default(0)
  appliedVia       ApplyMethod @default(EMAIL)
  emailConfidence  String?
  scheduledSendAt  DateTime?
  followUpSubject, followUpBody @db.Text, followUpStatus
Relations: belongsTo UserJob, User, Resume
Indexes: [userId,status], [userId,createdAt], [status,scheduledSendAt], [userId,sentAt]
```

### MODEL: Activity
Purpose: Timeline events for jobs (stage changes, sends, bounces).
```
Fields: id, userJobId?, userId, type (ActivityType enum), description, createdAt
Indexes: [userJobId], [userId,createdAt], [userId,type,createdAt]
```

### MODEL: SystemLock
Purpose: Distributed lock for cron mutual exclusion.
```
Fields: name @id, isRunning, startedAt, completedAt
```

### MODEL: SystemLog
Purpose: Audit/debug log entries.
```
Fields: id, type, source, message, metadata (Json), createdAt
Indexes: [type,createdAt], [source,createdAt], [type,source]
```

### MODEL: ScraperRun
Purpose: Per-scraper execution history and metrics.
```
Fields: id, source, status, jobsFound, jobsSaved, errorMessage, durationMs, query, startedAt, completedAt
Indexes: [source,startedAt], [status,startedAt]
```

### MODEL: UserFeedback
Purpose: Bug reports, suggestions from users.
```
Fields: id, userId, type, message, page, status, adminNote, createdAt, updatedAt
Indexes: [userId,createdAt], [status,createdAt]
```

## 2.2 Entity Relationship Diagram
```
CompanyEmail (standalone — no relations)

User
 ├──→ (1:1)  UserSettings ──→ (1:N) EmailTemplate
 ├──→ (1:N)  Resume
 ├──→ (1:N)  UserJob ──→ (N:1) GlobalJob
 │              └──→ (1:1) JobApplication ──→ (N:1) Resume
 │              └──→ (1:N) Activity
 ├──→ (1:N)  Activity
 ├──→ (1:N)  JobApplication
 ├──→ (1:N)  UserFeedback
 ├──→ (1:N)  Account
 └──→ (1:N)  Session
```

## 2.3 Enums

**JobStage:** `SAVED | APPLIED | INTERVIEW | OFFER | REJECTED | GHOSTED`

**ApplicationMode:** `MANUAL | SEMI_AUTO | FULL_AUTO | INSTANT`

**ApplicationStatus:** `DRAFT | READY | SENDING | SENT | FAILED | BOUNCED | CANCELLED`
```
Set to DRAFT:     instant-apply/route.ts:255, send-application.ts:50, application.ts:90+
Set to READY:     instant-apply/route.ts:240, application.ts:167 (markApplicationReady)
Set to SENDING:   send-application.ts:99
Set to SENT:      send-application.ts:125
Set to FAILED:    send-application.ts:155, send-queued/route.ts:46 (stuck recovery)
Set to BOUNCED:   send-application.ts:148, webhooks/email-bounce/route.ts:81
Set to CANCELLED: application.ts:274 (cancelApplication)
```

**ApplyMethod:** `EMAIL | MANUAL | PLATFORM`

**ActivityType:** `STAGE_CHANGE | NOTE_ADDED | COVER_LETTER_GENERATED | APPLICATION_PREPARED | APPLICATION_SENT | APPLICATION_FAILED | APPLICATION_BOUNCED | APPLICATION_CANCELLED | APPLICATION_COPIED | FOLLOW_UP_SENT | FOLLOW_UP_FLAGGED | MANUAL_UPDATE | DISMISSED | NOTIFICATION_SENT`

Note: `instant-apply` now correctly logs `APPLICATION_PREPARED` (not `APPLICATION_SENT`) when creating READY applications — the actual send happens later in `send-queued`.

## 2.4 Prisma Client

- **Instantiated:** `src/lib/prisma.ts` — singleton via `globalThis.prisma` (always stored, not dev-only)
- **Raw SQL:** 3 locations — `send-queued/route.ts:24` (lock), `send-scheduled/route.ts:24` (lock), `analytics.ts:94` (weekly aggregation)
- **Transactions:** 10+ locations across actions and crons
- **No Prisma middleware/extensions** — encryption handled manually

## 2.5 Dead Fields

| Field | Written | Read by Business Logic | Status |
|-------|---------|----------------------|--------|
| `GlobalJob.emailContributedBy` | Never (legacy) | Never | **DEAD** |
| `GlobalJob.expiryDate` | Scrapers | Never | **DEAD** |
| `Resume.textQuality` | resume.ts | Never | **DEAD** |
| `JobApplication.templateId` | application-email.ts | Never | **DEAD** |
| `JobApplication.followUpSubject/Body/Status` | check-follow-ups | Never displayed | **DEAD** |
| `UserSettings.resumeMatchMode` | settings form | Never — UI lies to user | **DEAD** |
| `UserSettings.cooldownMinutes` | settings form | canSendNow() — pauses sending when hourly limit hit | **ACTIVE** |
| `UserSettings.languages` | settings form | Never in matching | **DEAD** |
| `UserSettings.education` | settings form | Never in matching | **PARTIAL** |

---

# PART 3: SERVER-SIDE

## 3.1–3.2 API Routes & Cron Routes

See Quick Reference tables above for complete listings.

**Cron auth pattern** (all crons, `src/lib/cron-auth.ts`):
```typescript
export function verifyCronSecret(req: NextRequest): boolean {
  if (!expected) {
    console.error("[CronAuth] CRON_SECRET env var is not set");
    return false; // unauthorizedResponse() also writes to SystemLog
  }
  // Supports: Authorization Bearer, x-cron-secret header, ?secret= query param
  // Uses timing-safe comparison to prevent timing attacks on CRON_SECRET
  return timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
}
```

**WHY timing-safe comparison:** Prevents timing attacks. A naive `secret === input` leaks information — an attacker could guess the secret character-by-character by measuring response time. `timingSafeEqual` takes constant time regardless of where the mismatch occurs.

**WHY SystemLock exists:** Vercel can invoke the same function twice concurrently (e.g., two cron-job.org triggers within seconds). Locks prevent double-processing — e.g., send-queued claiming the same READY application twice. Each cron acquires a named lock before work, releases on exit.

**WHY acquireLock is try/catch wrapped:** DB connection failure shouldn't crash the entire cron. If `acquireLock` throws (e.g., Neon connection pool exhausted), the cron should skip gracefully and log, not propagate an unhandled error. Same for `releaseLock` — best-effort.

## 3.3 Server Actions

See Quick Reference table above. All server actions use `getAuthUserId()` for auth. Key validation: `settings.ts` uses comprehensive Zod schema (keywords max 30, 2-60 chars each; salary, categories, blacklist validated).

## 3.4 Server Components

| Page | Data Fetching | Key Queries |
|------|--------------|-------------|
| `/dashboard` | `getSettingsLite()`, `getTodaysQueue()`, `getDeliveryStats()`, `getJobs()` | UserSettings, UserJob+GlobalJob, JobApplication |
| `/jobs/[id]` | `prisma.userJob.findFirst()` with include | UserJob+GlobalJob+Application+Activities+Resume |
| `/recommended` | `getRecommendedJobs()` | GlobalJob (2000 row scan), scoring in-memory |
| `/applications` | `getApplications()`, `getSendingStats()` | JobApplication+UserJob+GlobalJob |
| `/analytics` | `getAnalytics()` | UserJob, Activity, JobApplication (batch query) |
| `/resumes` | `getResumesWithStats()` | Resume (content excluded) |
| `/templates` | `getEmailTemplates()` | EmailTemplate |
| `/settings` | `getSettings()` | UserSettings (decrypted, cached 300s) |

**Note:** All 8 dashboard pages had `export const dynamic = "force-dynamic"` removed. The dashboard layout's auth check (`cookies()`) already forces dynamic rendering — the explicit export was redundant.

## 3.5 Data Fetching Patterns

**Pattern A (Primary): Server Component → props → Client Component**
- Dashboard page fetches jobs, passes to `<KanbanBoard initialJobs={jobs} />`
- Job detail fetches full data, passes to `<JobDetailClient job={...} />`
- Settings page fetches settings, passes to `<SettingsForm initialSettings={...} />`

**Pattern B: Client-side fetch (rare)**
- `Header.tsx` fetches `GET /api/settings/mode` on mount
- `QuickApplyPanel.tsx` fetches `/api/applications/send-stats` on mount
- `StatusBanner.tsx` uses SWR with `/api/status` (auto-refresh)
- `SystemHealth` page fetches `/api/system-health` on mount
- All admin pages fetch their respective `/api/admin/*` endpoints

**Pattern C: Server Actions (most interactions)**
- All form submissions, stage changes, dismissals, bookmarks call server actions directly

## 3.6 Middleware

**File:** `src/middleware.ts` — Rate limiting only, NO auth checks.

**Matcher:** `/api/:path*`

**Bypassed:** `/api/cron/*`, `/api/webhooks/*`

**Per-path limits:**
| Path | Max Requests | Window |
|------|-------------|--------|
| /api/applications/generate | 20 | 60s |
| /api/applications/bulk-send | 5 | 60s |
| /api/email/test | 3 | 300s |
| /api/jobs/scan-now | 1 | 300s |
| /api/export | 2 | 3600s |
| /api/resumes/upload | 10 | 60s |
| /api/auth/* | 10 | 60s |
| /api/* (default) | 60 | 60s |

**Implementation:** In-memory Map (resets on cold start — broken across serverless instances).

## 3.7 Server-Side Libraries

| File | Purpose | Key Exports |
|------|---------|-------------|
| `prisma.ts` | DB singleton | `prisma` |
| `auth.ts` | NextAuth config | `authOptions`, `getAuthUserId()`, `getAuthSession()` |
| `admin.ts` | Admin check | `isAdmin()`, `requireAdmin()` |
| `admin-auth.ts` | Admin sessions | `validateAdminCredentials()`, `createAdminSession()`, `hasValidAdminSession()` |
| `encryption.ts` | AES-256-CBC | `encrypt()`, `decrypt()`, `encryptSettingsFields()`, `decryptSettingsFields()`, `hasDecryptionFailure()`, `getDecryptionFailures()` |
| `constants.ts` | Config values | `LIMITS`, `TIMEOUTS`, `MATCHING`, `STALE_DAYS`, `BANNED_KEYWORDS` |
| `cron-auth.ts` | Cron auth + SystemLog | `verifyCronSecret()`, `unauthorizedResponse()` — logs to SystemLog when CRON_SECRET missing |
| `groq.ts` | Groq API | `generateWithGroq()` — model: llama-3.1-8b-instant, 15s timeout, 2 retries; non-200 errors now include response body in thrown error |
| `ai-email-generator.ts` | Email gen | `generateApplicationEmail()` — 100-150 word limit, JSON output, 5 tone options |
| `ai-fallback.ts` | Fallback | `generateTemplateEmail()` — template-based when AI fails |
| `email.ts` | SMTP | `getTransporterForUser()`, `sendApplicationEmail()`, `sendNotificationEmail()`, `formatCoverLetterHtml()` — system transporter not cached when env creds missing |
| `email-errors.ts` | Error classify | `classifyError()` — permanent/transient/rate_limit/auth/network |
| `extract-email-from-text.ts` | Text extraction | `extractEmailFromText()` — standalone regex extraction, scoring by prefix patterns (HIRING_PREFIXES +10, PERSONAL_PATTERN -10), returns 85-95 confidence |
| `email-extractor.ts` | Find emails | `findCompanyEmail()` — 3 strategies: regex, careers scrape, pattern+MX |
| `email-verifier.ts` | MX check | `verifyEmailDomain()` — 30-min cache, 500 entries |
| `send-application.ts` | Core send | `sendApplication()` — claim, compose, send, update status |
| `send-limiter.ts` | Rate limit | `canSendNow()`, `getSendStats()` — warmup, per-provider, bounce pause; half-hour timezone offset sign fixed |
| `system-lock.ts` | Cron locks | `acquireLock()`, `releaseLock()` — acquireLock wrapped in try/catch for DB error resilience |
| `duplicate-checker.ts` | Dedup | `checkDuplicate()` — 7-day window, normalized company+title; falls back to `createdAt` when `sentAt` is null |
| `readiness-checker.ts` | Validation | `checkReadiness()` — mode-specific requirement checks |
| `notifications.ts` | Notify | `sendJobNotification()` |
| `notification-limiter.ts` | Throttle | `canSendNotification()`, `claimNotificationSlot()`, `recordNotification()` — atomic check+record to prevent concurrent double-sends |
| `cron-tracker.ts` | Cron logging | `createCronTracker(name)` → `.success()`, `.error()`, `.skipped()` — writes cron outcomes (success/error/skipped) to SystemLog; retry on DB failure |
| `webhooks.ts` | Alerts | `sendAlertWebhook()` — Discord, Telegram, generic |
| `job-categorizer.ts` | Classify | `categorizeJob()` — 28 categories from title+skills; returns null on failure instead of defaulting to "Software Engineering" |
| `resume-parser.ts` | PDF extract | `extractText()` — 3-method fallback (unpdf, pdf-parse, pdfjs) |
| `skill-extractor.ts` | Skills | `extractSkillsFromContent()`, `parseResume()` |
| `matching/score-engine.ts` | Scoring | `computeMatchScore()` — 7 factors, hard filters, 0-100 |
| `matching/resume-matcher.ts` | Resume pick | `pickBestResumeWithTier()` — category, skill, AI tiebreak |
| `matching/recommendation-engine.ts` | Recommend | `getRecommendedJobs()` — 2000-job query, 2-stage loading |
| `scrapers/*.ts` | Scraping | 8 source scrapers + runner + retry + rotation |

---

# PART 4: CLIENT-SIDE

## 4.0 Client Rationale (WHY)

**WHY Server Components as default:** Dashboard page fetches 4 data sources in parallel on the server (getSettingsLite, getTodaysQueue, getDeliveryStats, getJobs) and ships pre-rendered HTML. Zero client JS for data fetching on initial load. Only add "use client" when the component needs interactivity (onClick, useState, useEffect).

**WHY Zustand over Context:** React Context re-renders all consumers when any value changes. Zustand has selective subscriptions — `useJobStore(s => s.jobs)` only re-renders when `jobs` changes, not when `filter` changes. Critical for Kanban with 100+ job cards.

**WHY dynamic imports for Charts/Settings/Onboarding:** Recharts alone is ~150KB. Don't ship it on every page. `dynamic(..., { ssr: false })` code-splits these heavy components so the dashboard loads fast.

## 4.1 Key Client Components

| Component | File | Purpose | Hooks Used |
|-----------|------|---------|------------|
| KanbanBoard | kanban/KanbanBoard.tsx | Drag-drop job pipeline | useJobStore, @dnd-kit sensors |
| JobCard | kanban/JobCard.tsx | Job card in Kanban — email badges (green Mail when confidence ≥80, amber when lower, globe when no email), colored freshness dots (green/yellow/orange/red) | — |
| FreshnessIndicator | jobs/FreshnessIndicator.tsx | Job freshness badge (Fresh / Xd ago / may be filled / likely expired) | — |
| FreshnessDot | jobs/FreshnessIndicator.tsx | Compact dot for job lists | — |
| JobDetailClient | jobs/[id]/client.tsx | Job detail + actions | useRouter, useTransition, useState |
| QuickApplyPanel | jobs/QuickApplyPanel.tsx | AI email composer | useRouter, useTransition, useRef (debounce) |
| RecommendedClient | recommended/client.tsx | Browse AI matches — **3-way email filter** chips (All / Can Email / No Email) with live counts via useMemo | useRouter, useMemo, useCallback, useRef |
| ApplicationQueue | applications/ApplicationQueue.tsx | Email queue manager with quality badges, pre-send summary, optimistic state | useState, useCallback, useMemo (localStatuses Map, EmailQualityBadge, PreSendSummary) |
| SettingsForm | settings/SettingsForm.tsx | All user settings — **Auto-Apply Readiness** card on Automation tab (5 checks: mode, auto apply, resume, keywords, email; green/amber border; hidden when MANUAL) | useState (many), useTransition |
| OnboardingWizard | onboarding/OnboardingWizard.tsx | 4-step setup | useState |
| Header | layout/Header.tsx | Search + filters | useJobStore, useSidebarStore, useState, useEffect |
| Sidebar | layout/Sidebar.tsx | Navigation + live status | useSidebarStore, usePathname, useState, useEffect |
| StatusBanner | dashboard/StatusBanner.tsx | Live status | SWR (/api/status) |
| Charts | analytics/Charts.tsx | Recharts visuals | MutationObserver (dark mode) |
| LoginForm | login/LoginForm.tsx | OAuth + magic link | useState |
| TemplateEditor | templates/TemplateEditor.tsx | Email template CRUD | useState, useTransition |
| ResumeList | resumes/ResumeList.tsx | Resume management | useState, useTransition |
| BulkActionsBar | dashboard/BulkActionsBar.tsx | Bulk operations | useTransition |
| TodaysQueue | dashboard/TodaysQueue.tsx | Daily job queue | useState |
| FeedbackWidget | shared/FeedbackWidget.tsx | Bug/suggestion reporter | useState |
| ThemeToggle | shared/ThemeToggle.tsx | Dark/light toggle | useTheme |
| KeyboardShortcuts | shared/KeyboardShortcuts.tsx | Global shortcuts | useEffect (keydown) |

## 4.2 Routing & Navigation

**Sidebar links:** Dashboard, Jobs (Recommended), Applications, Resumes, Templates, Analytics, Settings, Admin (if admin)

**Sidebar automation badge:** Fetches `/api/settings/mode` on mount to show live account status.
- Active: green pulsing dot + "Auto-Search Active" (emerald gradient)
- Paused: amber pause icon + "Auto-Apply Paused" (amber gradient)

**Dynamic routes:** `/jobs/[id]`, `/api/cron/scrape/[source]`, `/api/admin/users/[id]`, `/api/applications/[id]/send`, `/api/resumes/[id]/preview`

**Error boundaries:** 10 error.tsx files across all dashboard routes + admin

**Loading skeletons:** 11 loading.tsx files — every dashboard page has one

**404:** `src/app/not-found.tsx` — links to /dashboard

## 4.3 State Management

**Zustand (global):**
- `useJobStore` — jobs array, filter (stage), search, sourceFilter, categoryFilter, minScore; actions: setJobs, updateJobStage, revertMove, removeJob, getJobsByStage
- `useSidebarStore` — collapsed, mobileOpen; actions: toggle, setCollapsed, setMobileOpen

**React Context:**
- `ThemeProvider` — theme (light/dark/system), setTheme; persisted to localStorage key `"theme"`
- `SessionProvider` — NextAuth session wrapper

**SWR (single usage):**
- `StatusBanner.tsx` — fetches `/api/status` with auto-refresh

**localStorage:**
- `"theme"` — dark/light/system preference (ThemeProvider)

## 4.4 Client-Side Data Fetching

| Component | Endpoint | Method | Trigger |
|-----------|----------|--------|---------|
| StatusBanner | /api/status | GET | SWR auto-refresh |
| Header | /api/settings/mode | GET | useEffect on mount |
| QuickApplyPanel | /api/applications/{id}/send | POST | Button click |
| QuickApplyPanel | /api/applications/send-stats | GET | useEffect on mount |
| QuickApplyPanel | /api/settings/mode | GET | useEffect on mount |
| JobForm | /api/jobs/extract-url | POST | URL paste |
| OnboardingWizard | /api/resumes/upload | POST | File upload |
| SystemHealth | /api/system-health | GET | useEffect on mount |
| Admin pages | /api/admin/* | GET/POST | useEffect on mount |

## 4.5 UI Component Library (shadcn/ui)

20 primitives: `Button`, `Badge`, `Card`, `Input`, `Select`, `Textarea`, `Label`, `Dialog`, `AlertDialog`, `Popover`, `Tabs`, `Calendar`, `Switch`, `DropdownMenu`, `Sheet`, `Tooltip`, `Separator`, `Progress`, `Sonner` (toast), `AsMark`

## 4.6 Theme & Styling

- **Dark mode:** `class` strategy via custom ThemeProvider, persisted to localStorage
- **CSS:** Tailwind utility classes + HSL CSS variables in globals.css
- **Font:** Inter (Google Fonts via next/font)
- **Class merging:** `cn()` utility using `clsx` + `tailwind-merge`
- **Animations:** Framer Motion (landing), tailwindcss-animate (app), CSS transitions

---

# PART 5: BUSINESS LOGIC

## 5.0 Business Logic Rationale (WHY)

**WHY email warmup (3/day → 8/day → unlimited):** Gmail and Outlook flag accounts that go from 0 to 50 emails overnight. Gradual ramp (3/day days 1-3, 8/day days 4-7) reduces spam folder risk and account suspension.

**WHY bounce distinction:** "550 user unknown" = bad email, our fault — clear GlobalJob.companyEmail so we don't retry. "550 policy rejection" = server config, not necessarily a bad address — treat differently for retry logic. Permanent vs transient classification drives retry behavior.

**WHY email confidence system exists:** Prevents sending to guessed emails (e.g., careers@company.com) that will bounce. description_text and careers_page emails are verified in context; pattern_guess is RCPT-verified but still risky. Auto-send only for confidence ≥ 80.

## 5.1 Job Scraping

| Source | File | Method | API Key |
|--------|------|--------|---------|
| JSearch | scrapers/jsearch.ts | RapidAPI REST | RAPIDAPI_KEY |
| Indeed | scrapers/indeed.ts | RapidAPI REST | RAPIDAPI_KEY |
| LinkedIn | scrapers/linkedin.ts | RSS + web scrape | None |
| Remotive | scrapers/remotive.ts | Public REST API | None |
| Arbeitnow | scrapers/arbeitnow.ts | Public REST API | None |
| Adzuna | scrapers/adzuna.ts | REST API | ADZUNA_APP_ID/KEY |
| Google Jobs | scrapers/google-jobs.ts | SerpAPI | SERPAPI_KEY |
| Rozee.pk | scrapers/rozee.ts | Web scrape | None |
| LinkedIn Posts | scrapers/google-hiring-posts.ts | Google CSE (free) → SerpAPI fallback | GOOGLE_CSE_KEY+GOOGLE_CSE_ID or SERPAPI_KEY |

**Dedup:** `@@unique([sourceId, source])` — upsert by externalId per source.

**In-code rate limiting:** Paid scrapers (JSearch, Indeed, Google Jobs, Rozee) use 150–200ms sleeps between API calls to prevent burst requests that could get API keys suspended.

**Fresh marking:** `isFresh: true` on insert, set to `false` after instant-apply processes.

**LinkedIn Posts scraper (google-hiring-posts.ts):** Keyword-only queries first (global reach), then keyword+city. 7-day window (dateRestrict=d7 for CSE, qdr:w1 for SerpAPI). Broader terms: "hiring", "we are hiring", "looking for", "join our team", etc. Uses all available text fields for email extraction: `title`, `snippet`, `htmlSnippet` (stripped of HTML), `pagemap.metatags[0].og:description`, `pagemap.metatags[0].description`. Emails found in hiring posts get `emailConfidence: 90`, `emailSource: "hiring_post"`. Runs inside scrape-global as `linkedin_posts`.

**scrape-global email extraction:** Extracts emails during job save via `extractEmailFromText(job.description)`. New jobs get `emailSource: "description_text"`, `emailConfidence: 85-95`. Scraper-provided confidence/source (e.g. hiring posts at 90) are preserved when available. Existing jobs without email get enriched on rescrape (`description_text_rescrape`).

**Keyword aggregator (paid mode):** Ranks keywords by application outcomes (sent applications), not just popularity. Keywords that led to sent apps in the last 30 days get 3× weight.

## 5.2 Matching Engine

**File:** `src/lib/matching/score-engine.ts` — `computeMatchScore()`

**7 Scoring Factors:**
| Factor | Weight | How Calculated |
|--------|--------|---------------|
| Keyword Match | 0-30 | User keywords vs job title+description |
| Title Relevance | 0-20 | Keywords appearing in job title |
| Skill Match | 0-20 | Resume skills vs job skills |
| Category | 0-10 | User preferred categories vs job category |
| Location | 0-10 | City/country/remote match |
| Experience Level | ±5 to -15 | Senior/mid/entry alignment |
| Freshness | 0-5 | Posted date bonus |

**Hard Filters (score=0):**
Platform preference, company blacklist, negative keywords, at least 1 keyword must match, category filter, location filter, salary bounds.

**Thresholds:** SHOW=40, NOTIFY=50, AUTO_DRAFT=55, AUTO_SEND=65 (match score). Email confidence for auto-send: ≥ 80. **Email filter options:** recommendation-engine supports `emailFilter: "all" | "verified" | "none"` for server-side filtering on recommended page.

**Email confidence scores (auto-send eligibility):**
| Source | Score | Auto-send |
|--------|-------|-----------|
| description_text (extractEmailFromText) | 85-95 | ✓ |
| hiring_post (google-hiring-posts.ts) | 90 | ✓ |
| careers_page (email-extractor scrape) | 82 | ✓ |
| pattern_guess (RCPT-verified guess) | 35 | ✗ draft only |
| Auto-send threshold | 80 | — |
| Bulk-send threshold | 80 | — |

## 5.3 AI Email Generation

**Provider:** Groq API — `llama-3.1-8b-instant`
**Temperature:** 0.7 | **Max tokens:** 800
**Timeout:** 15s per call | **Retries:** 2 with exponential backoff

**System prompt (summarized):** 100-150 word limit, no clichés, no placeholders, 2-3 specific qualifications, call-to-action, mention resume attached, no links in body, 5 tone options (professional/confident/friendly/casual/formal), custom language support, JSON output format.

**Fallback:** `ai-fallback.ts` → `generateTemplateEmail()` — simple template with job title, company, skills.

**Output:** Stored in `JobApplication.subject`, `JobApplication.emailBody`, `JobApplication.coverLetter`

## 5.4 Email Sending Pipeline

```
Step 1: Trigger → send-queued/route.ts (cron) or /api/applications/[id]/send (manual)
Step 2: Load application → send-application.ts:17 → prisma.jobApplication.findUnique()
Step 3: Validate → :25-29 → recipientEmail exists, not already SENT
Step 4: Rate limit → :40 → canSendNow(userId)
Step 5: Duplicate check → :46 → checkDuplicate()
Step 6: Load settings → :33-37 → prisma.userSettings + decryptSettingsFields()
Step 7: Build transporter → :52-62 → getTransporterForUser(settings)
Step 8: Download resume → :70-90 → fetch(fileUrl) with 15s timeout
Step 9: Atomic claim → :94-99 → updateMany status DRAFT/READY → SENDING
Step 10: Clean content → :105-106 → cleanJsonField(subject), cleanJsonField(body)
Step 11: Send email → :108-119 → transporter.sendMail({from, to, subject, text, html, attachments})
Step 12: On success → :122-139 → $transaction: status→SENT, stage→APPLIED, create Activity
Step 13: On permanent fail → :145-173 → status→BOUNCED, clear GlobalJob.companyEmail
Step 14: On transient fail → :175-196 → retry or revert to READY
```

**Complete Status Lifecycle:**
```
GlobalJob created (scraped)
  ↓ match-jobs or match-all-users cron
UserJob created (stage=SAVED, matchScore=X)
  ↓ instant-apply cron OR user clicks "Generate" in QuickApplyPanel
JobApplication created (status=DRAFT or READY)
  ↓ User clicks "Mark Ready" OR auto-approved (FULL_AUTO + high score + high confidence)
status: DRAFT → READY
  ↓ send-queued cron (every 5 min) OR send-scheduled cron
status: READY → SENDING (atomic claim)
  ↓ transporter.sendMail()
status: SENDING → SENT (success) | FAILED (SMTP error) | BOUNCED (recipient rejected)
  ↓ follow-up cron (14+ days)
UserJob.stage: APPLIED → GHOSTED (if no response)
```

## 5.5 User Flows

**Auto-Apply:** User enables FULL_AUTO + autoApplyEnabled + instantApplyEnabled in Settings → `saveSettings()` → instant-apply cron processes fresh jobs → AI generates email → READY if score ≥ threshold + confidence ≥ 80 → send-queued cron sends → user sees SENT on dashboard.

**Manual Apply:** User browses /dashboard/jobs/[id] → clicks "Generate" in QuickApplyPanel → `generateApplication()` server action → AI email draft displayed → user edits subject/body/resume → clicks "Send" → `POST /api/applications/{id}/send` → email sent → toast notification.

**Platform Apply:** User clicks "Apply on Site" → opens external URL → clicks "Mark as Applied" dropdown → selects platform → `markAppliedFromSite()` server action → creates application record with `appliedVia: "PLATFORM"`.

## 5.6 Resume System

- **Upload:** `POST /api/resumes/upload` — PDF only, max 5MB, max 10 resumes, max 20MB total
- **Storage:** Vercel Blob (via `@vercel/blob`)
- **Parsing:** `resume-parser.ts` — 3-method fallback (unpdf → pdf-parse → pdfjs-dist)
- **Skills:** `skill-extractor.ts` — SKILL_ALIASES map, section detection, experience years
- **Selection:** `resume-matcher.ts` — 4 tiers: category match → skill overlap → AI tiebreaker → default

## 5.7 Rate Limiting & Send Limiter

| Limit | Value | Source |
|-------|-------|--------|
| Warmup Day 1-3 | 3/day, 2/hour | send-limiter.ts:211-213 |
| Warmup Day 4-7 | 8/day, 4/hour | send-limiter.ts:215 |
| Gmail | 500/day, 60/hour | send-limiter.ts:18 |
| Outlook | 300/day, 30/hour | send-limiter.ts:19 |
| Brevo | 300/day, 60/hour | send-limiter.ts:21 |
| Custom SMTP | User config | send-limiter.ts:20 |
| Bounce auto-pause | 3 bounces/day → 24h pause | send-limiter.ts:161-174 |
| Min delay between sends | sendDelaySeconds (default 120) | send-limiter.ts — per-user |
| Cooldown after burst | cooldownMinutes (default 30) — pauses on hourly limit hit | send-limiter.ts — per-user |
| Cron inter-send delay | User's sendDelaySeconds (was hardcoded 1s) | send-queued, send-scheduled, instant-apply |

## 5.8 Follow-Up System

- **follow-up cron (daily 10AM):** Marks jobs GHOSTED after 14 days, flags follow-up reminders after 7 days
- **check-follow-ups cron (daily 11AM):** AI-generates follow-up email drafts via Groq for flagged jobs (< 2 follow-ups)
- **User configuration:** Not configurable (fixed 7/14 day thresholds)

## 5.9 Notification System

| Type | Trigger | Delivery | Configurable |
|------|---------|----------|-------------|
| New matches | notify-matches cron | Email | emailNotifications toggle |
| Instant-apply results | instant-apply cron | Email | emailNotifications toggle |
| Bounce alert | email-bounce webhook | Email | Always |
| System degradation | health check | Discord/Telegram webhook | ALERT_*_WEBHOOK env |

No in-app notification center. No push notifications. No WebSocket/SSE.

## 5.10 Dead Settings

| Setting | UI | DB | Actually Enforced |
|---------|----|----|-------------------|
| resumeMatchMode | ✓ dropdown | ✓ stored | **NEVER READ** by matching logic |
| cooldownMinutes | ✓ input | ✓ stored | **ACTIVE** — triggers sendingPausedUntil when hourly limit hit |
| languages | ✓ multi-select | ✓ stored | **NEVER READ** by matching/filtering |
| education | ✓ select | ✓ stored | **NEVER READ** by matching |

---

# PART 6: AUTHENTICATION

## 6.1 Auth Configuration

**Library:** NextAuth 4.24.13 | **Config:** `src/lib/auth.ts`

**Providers:** Google OAuth, GitHub OAuth, Email (magic link via SMTP)

**Session strategy:** Database (Prisma adapter)

**Session fields:** `{ user: { id, name, email, image } }` — all four fields populated in session callback

**Callbacks:** `session()` — adds `user.id`, `user.email`, `user.name` to session object

**Events:** `createUser()` — auto-creates `UserSettings` record

## 6.2 Client-Side Auth

**Login:** `src/app/login/LoginForm.tsx` — Google/GitHub buttons + email input for magic link

**Session:** `SessionProvider` wraps root layout; server components use `getServerSession()`

## 6.3 Server-Side Auth

- **Server Components:** `getAuthSession()` in dashboard layout → redirects to /login
- **Server Actions:** `getAuthUserId()` → throws if no session
- **API Routes:** `getAuthUserId()` or `getAuthSession()` → returns 401
- **Cron Routes:** `verifyCronSecret(req)` → returns 401
- **Admin:** `requireAdmin()` checks both OAuth + credential session

## 6.4 Route Protection

| Route | Level | Method |
|-------|-------|--------|
| / | Public | None |
| /login | Public | None |
| /admin/login | Public | None |
| /dashboard/* | Authenticated | Layout redirect to /login |
| /admin/* | Admin | Layout redirect to /admin/login |
| /api/cron/* | Cron secret | verifyCronSecret() → 401 |
| /api/admin/* | Admin | requireAdmin() → 403 |
| /api/health, /api/version | Public | None |
| /api/* (other) | Authenticated | getAuthUserId() → 401 |

---

# PART 7: DATA FLOW DIAGRAMS

## 7.1 Complete Server Pipeline

```
[cron-job.org] → GET /api/cron/scrape/linkedin?secret=xxx
                        │
              [scrapeLinkedIn() in scrapers/linkedin.ts]
                        │
              [scraper-runner.ts → prisma.globalJob.upsert()]
                        │
              ══════════ CRON BOUNDARY ══════════
                        │
[cron-job.org] → GET /api/cron/match-all-users?secret=xxx
                        │
              [match-all-users/route.ts → computeMatchScore() in score-engine.ts]
                        │
              [prisma.userJob.create() per user × matched job]
                        │
              ══════════ CRON BOUNDARY ══════════
                        │
[cron-job.org] → GET /api/cron/instant-apply?secret=xxx
                        │
              [instant-apply/route.ts:44 → fetch fresh jobs]
              [instant-apply/route.ts:180 → findCompanyEmail()]
              [instant-apply/route.ts:209 → generateInstantEmail() → Groq API]
              [instant-apply/route.ts:245 → prisma.jobApplication.create({status: DRAFT|READY})]
                        │
              ══════════ CRON BOUNDARY ══════════
                        │
[cron-job.org] → GET /api/cron/send-queued?secret=xxx
                        │
              [send-queued/route.ts:24 → acquireLock('send-applications')]
              [send-queued/route.ts:49 → prisma.jobApplication.findMany({status: READY})]
              [send-queued/route.ts:72 → sendApplication() in send-application.ts]
                        │
              [send-application.ts:108 → transporter.sendMail()]
              [send-application.ts:122 → $transaction: SENT + APPLIED + Activity]
```

## 7.2 Client ↔ Server Data Flow

**Dashboard:**
```
Browser → /dashboard → Server Component
  → getSettingsLite() → checks isOnboarded
  → getJobs() → prisma.userJob.findMany() → passes to <KanbanBoard initialJobs={} />
  → getTodaysQueue() → passes to <TodaysQueue />
  → getDeliveryStats() → passes to <DeliveryStats />
  Client: KanbanBoard uses useJobStore (Zustand) for drag-drop
  Client: StatusBanner fetches /api/status via SWR (auto-refresh)
```

**Job Detail:**
```
Browser → /dashboard/jobs/[id] → Server Component
  → prisma.userJob.findFirst() with includes
  → passes to <JobDetailClient job={} resumes={} profile={} />
  Client: User clicks "Generate" → startTransition → generateApplication() server action
  Client: User edits draft → debounced updateApplicationDraft() (500ms)
  Client: User clicks "Send" → fetch POST /api/applications/{id}/send
```

**Settings:**
```
Browser → /dashboard/settings → Server Component
  → getSettings() → decrypted settings → passes to <SettingsForm initialSettings={} />
  Client: User fills form → saveSettings() server action → encrypts + saves
  Client: Toast on success/failure
```

## 7.3 Onboarding Flow

```
[User signs up → OAuth/magic link] → [NextAuth createUser event → UserSettings created]
  → [Redirect to /dashboard → isOnboarded=false → <OnboardingWizard />]
  → Step 1: About You — fullName, phone, linkedin, github, portfolio
  → Step 2: Job Preferences — keywords, city, country, experienceLevel, categories, platforms
  → Step 3: Resume — upload PDF → /api/resumes/upload → parse + extract skills
  → Step 4: Ready! — shows match preview, seeds starter templates
  → [saveSettings() + completeOnboarding() + /api/onboarding/complete (matches existing jobs)]
  → [Redirect to /dashboard with Kanban populated]
```

---

# PART 8: EXTERNAL INTEGRATIONS

## 8.1 External APIs

| Service | Purpose | Auth | File |
|---------|---------|------|------|
| Groq | AI email/cover letter | Bearer GROQ_API_KEY | groq.ts |
| RapidAPI (JSearch) | Job scraping | X-RapidAPI-Key | scrapers/jsearch.ts |
| RapidAPI (Indeed) | Job scraping | X-RapidAPI-Key | scrapers/indeed.ts |
| Adzuna | Job scraping | app_id + app_key in URL | scrapers/adzuna.ts |
| SerpAPI | Google Jobs scraping | api_key in URL | scrapers/google-jobs.ts |
| Brevo SMTP | System emails | SMTP auth | email.ts |
| Vercel Blob | Resume storage | BLOB_READ_WRITE_TOKEN | resumes/upload/route.ts |

## 8.2 SMTP Configuration

**User SMTP fields:** emailProvider, smtpHost, smtpPort, smtpUser, smtpPass (encrypted)

**Supported:** Gmail (service: gmail), Outlook (smtp-mail.outlook.com:587), Brevo (default), Custom SMTP

**Password encryption:** AES-256-CBC with ENCRYPTION_KEY, IV prepended to ciphertext

**Transporter cache:** 10-minute TTL, pooled (3 max connections)

## 8.3 External Triggers

**cron-job.org:** All 11 cron routes via HTTP GET with `?secret=` or `Authorization: Bearer` header

**Webhooks:** `POST /api/webhooks/email-bounce` — Brevo bounce/spam notifications, HMAC-SHA256 verified

## 8.4 Client-Side Third Party

- **Font:** Inter via `next/font/google`
- **Analytics:** None detected
- **Error tracking:** None detected

---

# PART 9: PERFORMANCE

## 9.0 Performance Rationale (WHY)

**WHY region alignment matters:** Neon DB in us-east-1 + Vercel iad1 = same region. Cross-region requests add 60-80ms per query. With 15+ queries per page load, that's 1+ second of pure latency. Keeping DB and functions in the same region is critical.

**WHY connection_limit=5:** Vercel spawns many concurrent function instances. Each needs DB connections. Neon free tier has limits. Lower connection pool prevents "too many connections" errors during traffic spikes.

## 9.1 Server Performance

- **Heavy query:** `getRecommendedJobs()` loads 2000 GlobalJobs, scores in-memory
- **Optimization:** 2-stage description loading (light query first, lazy-load descriptions for borderline)
- **Caching:** `getSettings()` uses `unstable_cache` with 300s revalidation
- **No redundant force-dynamic:** Removed from all 8 dashboard pages (layout auth already forces dynamic)
- **N+1 risk:** instant-apply loops users × jobs with individual queries
- **Soft limit:** CRON_SOFT_LIMIT_MS = 8000ms prevents Hobby plan timeout

## 9.2 Client Performance

- **Dynamic imports:** Charts (analytics), TemplateEditor, OnboardingWizard, SettingsForm — all `ssr: false`
- **Memoization:** JobCard in RecommendedClient
- **Suspense:** Every dashboard page has loading.tsx
- **Debouncing:** Search (400ms), draft save (500ms)
- **Optimistic UI:** Kanban stage moves update store immediately, revert on error

---

# PART 10: SECURITY

## 10.1 Server Security

- **SQL injection:** Prisma parameterized (safe). Raw SQL uses tagged templates (safe)
- **Auth:** All user routes check `getAuthUserId()`. Crons use `verifyCronSecret()`
- **CSRF:** Server Actions have built-in CSRF via Next.js
- **Rate limiting:** Middleware with in-memory Map (broken across serverless instances)
- **Encryption:** AES-256-CBC for PII, timing-safe comparison for admin auth
- **Input validation:** Zod on settings, email templates, feedback. Missing on some API routes

## 10.2 Client Security

- **XSS:** No `dangerouslySetInnerHTML` found. `escapeHtml()` used in email HTML
- **Secrets:** No NEXT_PUBLIC_ secrets. SMTP passwords never sent to client
- **Prompt injection:** `sanitizeForPrompt()` strips code blocks, system/assistant markers, script tags

## 10.3 Public Endpoints

| Route | Exposed | Should Be Public? |
|-------|---------|-------------------|
| /api/health | Scraper status, SMTP config, error logs, job counts | Debatable — exposes infrastructure details |
| /api/version | Build timestamp | Yes |

---

# PART 11: KNOWN ISSUES

## 11.1 Silent Failures (Mostly Fixed)

| File:Line | Pattern | Status |
|-----------|---------|--------|
| ~~send-queued/send-scheduled lock~~ | Same lock name | **FIXED** — separate lock names |
| ~~instant-apply recipientEmail~~ | Empty string allowed | **FIXED** — validation added |
| ~~send-application resume download~~ | Sent without resume | **FIXED** — returns to READY for retry |
| ~~send-application JSON~~ | Corrupted emails | **FIXED** — `cleanJsonField()` scrubs |
| ~~send-application validation~~ | Blank emails | **FIXED** — non-empty subject/body enforced |
| ~~notification-limiter race~~ | Double notifications | **FIXED** — `claimNotificationSlot()` atomic check+record |
| ~~encryption.ts~~ | Decryption failure = null | **FIXED** — `_decryptionFailures` tracking |
| ~~cron-auth.ts~~ | CRON_SECRET missing = silent 401 | **FIXED** — logs to SystemLog on missing secret |
| ~~email.ts systemTransporter~~ | Cached broken transporter | **FIXED** — not cached when creds missing |
| ~~email-templates.ts APP_URL~~ | Module-level = stuck at localhost | **FIXED** — lazy `getAppUrl()` re-evaluates |
| Remaining: `ActivityTracker:12` | `.catch(() => {})` | Acceptable — heartbeat is fire-and-forget |
| ~~email-errors.ts plain objects~~ | `String({message: "..."})` → `"[object Object]"` broke phrase matching | **FIXED** — `isAddressNotFound()` and `classifyError()` now extract `.message` from plain objects before falling back to `String(error)` |

**Admin triggers:** scrape-posts removed from admin trigger list — LinkedIn posts run inside scrape-global. backfill-emails added. send-scheduled correctly maps to `/api/cron/send-scheduled` (not send-queued).

## 11.2 Type Safety Issues

| File:Line | Issue | Status |
|-----------|-------|--------|
| manifest.ts:32 | `as any` on PWA config | Remaining |
| dashboard/page.tsx | `as any` on queue data + Kanban jobs | Remaining |
| jobs/[id]/page.tsx | `as any` on job prop | Remaining |
| auth.ts:13-18 | `!` assertions on OAuth env vars | Remaining |
| ~~analytics.ts sentAt~~ | Double `!` on sentAt | **FIXED** — optional chaining with fallback |

## 11.3 Hardcoded Values

| File | Value | Status |
|------|-------|--------|
| ~~email-templates.ts~~ | Hardcoded fallback URL | **FIXED** — lazy `getAppUrl()` re-evaluates from env vars; re-resolves if stuck at localhost |
| instant-apply:540 | `"https://jobpilot.vercel.app"` | Should use NEXT_PUBLIC_APP_URL |
| All cron routes | `maxDuration: 60` | Ignored on Hobby plan (10s limit); soft timeout (8s) handles gracefully |
| ~~Cron send delays~~ | `INTER_SEND_DELAY_MS: 1000, INSTANT_APPLY_DELAY_MS: 1500` | **FIXED** — now uses per-user `sendDelaySeconds` from UserSettings |

## 11.4 Dead Code

| Type | Name | File | Why Dead |
|------|------|------|----------|
| Env var | BREVO_API_KEY | .env | Never imported anywhere |
| DB field | emailContributedBy | GlobalJob | Written, never read |
| DB field | expiryDate | GlobalJob | Written, never read |
| DB field | textQuality | Resume | Written, never read |
| DB field | templateId | JobApplication | Written, never read |
| DB field | followUpSubject/Body/Status | JobApplication | Written, never displayed |
| Setting | resumeMatchMode | UserSettings | Saved, never used in matching |
| Setting | cooldownMinutes | UserSettings | **ACTIVE** — used by canSendNow() for hourly burst cooldown |

## 11.5 Incomplete Features

| Feature | What Exists | What's Missing |
|---------|------------|----------------|
| Follow-up emails | AI generates drafts, stored in DB — counter now transactional with draft save | No UI to view/edit/send follow-ups |
| Resume match mode | Setting saved as "smart"/"keyword" | Matching always uses default algorithm |
| Peak hours only | Boolean + timezone saved | Implementation checks exists but incomplete |
| Webhook alerts | Full implementation in webhooks.ts | Env vars likely not configured |

---

# PART 12: DEPLOYMENT & PWA

## 12.1 Vercel Config
- **Region:** iad1
- **No crons in vercel.json** — all crons handled by cron-job.org (Vercel Hobby plan doesn't support crons)

## 12.2 PWA
- **Manifest:** `src/app/manifest.ts` — name: JobPilot, standalone, theme #059669 (emerald green)
- **Icons:** SVG icons at `public/icon-192.svg` and `public/icon-512.svg` (green paper plane gradient)
- **Share target:** GET `/jobs/new?shared_url=&text=&title=` — share job URLs to app
- **Service worker:** NOT FOUND
- **Offline:** NOT IMPLEMENTED

## 12.3 Build & Deploy
```bash
npm run build     # prisma generate && prisma db push --skip-generate && next build
npm run db:push   # prisma db push (manual schema sync)
npm run db:seed   # prisma db seed (demo data)
```

**Note:** The build script runs `prisma db push` automatically on every deploy, ensuring schema is always in sync.

## 12.4 Database Migrations
No migrations directory — uses `prisma db push` for schema sync.

---

*End of SYSTEM-ARCHITECTURE.md*
