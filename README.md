# JobPilot

AI-powered job search platform that finds the best jobs across 8 sources, scores them against your profile, generates personalized applications, and makes applying take 90 seconds &mdash; whether it's email, ATS form, or LinkedIn Easy Apply.

**Stack:** Next.js 14 (App Router) &bull; TypeScript &bull; Tailwind CSS &bull; shadcn/ui &bull; PostgreSQL (Neon) &bull; Prisma &bull; NextAuth.js &bull; Groq AI &bull; Vercel

## Features

### Job Discovery & Matching
- **9 job sources + manual** &mdash; Indeed, Remotive, Arbeitnow, LinkedIn Jobs, LinkedIn Posts (via Google), Rozee, JSearch, Adzuna, Google Jobs, plus Quick Add from URL
- **Scraper boost** &mdash; All scrapers fetch significantly more data: LinkedIn (8×3×2×2), JSearch (6 queries, 3 cities, 2 pages), Indeed (8 queries, 3 cities, 2 pages), Adzuna (8 queries, 3 pages, 50/page, 14 days), Google Jobs (5 queries, 3 cities, daily), Rozee (5 queries, daily), Remotive (200 limit), Arbeitnow (3 pages)
- **Smart matching** &mdash; 8 hard filters + 7 scoring factors (keyword, category, location, experience, salary, resume-skill overlap, freshness)
- **Negative keywords** &mdash; exclude irrelevant jobs (e.g., "wordpress", "php", "internship")
- **Company blacklist** &mdash; hide specific companies from results

### Application Pipeline
- **Daily Queue ("Today's Jobs")** &mdash; Dashboard shows top 10 highest-scored new jobs from last 48h, split into "Auto-Apply Ready" (verified email) and "Quick Apply" (apply on site). Progress bar shows applied count. Component: `TodaysQueue.tsx`, server action: `getTodaysQueue()`.
- **Flipped primary action** &mdash; "Apply on Site" is the primary button (blue, prominent) on job cards and job detail; "Email Apply" is secondary, only shown for jobs with verified email (confidence ≥70). Aligns with the reality that ~85% of jobs don't have email.
- **Quick Apply Kit** &mdash; One-click copy buttons on job detail for Full Name, Email, Phone, LinkedIn, Portfolio, GitHub, plus "Copy All" for formatted details block. Component: `QuickApplyKit.tsx`.
- **AI pitch generation** &mdash; `POST /api/jobs/generate-pitch` generates short pitch (3–4 sentences for "Why are you interested?") and full cover letter, tailored to the job. Called on-demand from Quick Apply Kit.
- **Streaming cover letter generation** &mdash; `POST /api/jobs/generate-pitch?stream=true` streams the cover letter token-by-token via the `streamWithGroq()` function in `src/lib/groq.ts`. The `useStreamingPitch` React hook (`src/hooks/use-streaming-pitch.ts`) manages the `ReadableStream`, appending tokens to state as they arrive. `QuickApplyKit.tsx` wires the hook to render the cover letter with a live blinking cursor while streaming, replacing it with a copy button on completion.
- **Manual application tracking** &mdash; "I Applied" button on job detail creates `JobApplication` with `appliedVia: "PLATFORM"` and marks UserJob as APPLIED. Server action: `markAppliedFromSite()`. Tracks all applications (email, site, LinkedIn), not just email.
- **Kanban board** with drag-and-drop (Saved, Applied, Interview, Offer, Rejected, Ghosted)
- **4 application modes** &mdash; Manual, Semi-Auto, Full-Auto, Instant Apply
- **AI email generation** &mdash; personalized subject, body, and cover letter via Groq (Llama 3.1)
- **Email sending** &mdash; Gmail, Outlook, or custom SMTP with rate limiting, bounce detection, 8-layer safety, and email warmup
- **Email confidence** &mdash; numeric scoring (0-100) for extracted emails; auto-send only for verified (70+)
- **Resume management** &mdash; upload PDF, auto-detect 200+ skills, 4-tier resume-job matching
- **Email templates** &mdash; customizable with `{{company}}`, `{{position}}`, `{{name}}` placeholders
- **Bulk operations** &mdash; dismiss, save, delete multiple jobs; clear old/rejected/failed applications

### Analytics & Insights
- **Delivery stats dashboard** &mdash; Weekly stats: sent, bounced, failed, drafts, delivery rate with trend indicator, email vs site application breakdown, email availability bar (verified/unverified/none). Component: `DeliveryStats.tsx`, server action: `getDeliveryStats()`.
- **Analytics dashboard** &mdash; applications over time, source breakdown, score distribution, response rates, speed metrics, keyword effectiveness
- **Keyword effectiveness** &mdash; per-keyword match/save/dismiss/apply counts to optimize your search
- **Admin panel** &mdash; system stats, API quotas, scraper health + quality metrics, email delivery stats, user management, log viewer, database cleanup

### User Experience
- **Dark mode** &mdash; full dark/light/system theme support
- **Onboarding wizard** &mdash; guided setup with validation
- **Feedback widget** &mdash; in-app bug reports and suggestions
- **Activity tracking** &mdash; admin visibility into user engagement
- **Performance optimized** &mdash; parallel data fetching, settings caching, DB connection pooling, lazy-loaded components
- **PWA installable** &mdash; add to home screen, share jobs from any app directly to JobPilot
- **Quick Add from URL** &mdash; paste any job URL (LinkedIn, Indeed, career page) and auto-extract title, company, location, description, email
- **Stack acronym matching** &mdash; "MERN" automatically matches react, node, mongodb, express keywords (also MEAN, PERN, LAMP, T3, etc.)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (local or hosted, e.g. Neon, Supabase)
- OAuth credentials for Google and/or GitHub
- (Optional) API keys for job sources and AI

### Setup

```bash
git clone https://github.com/GitMuhammadAli/JobPilot.git
cd JobPilot
cp .env.example .env
```

Fill in `.env` with your credentials (see below), then:

```bash
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes | App URL (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Yes | Same as `NEXTAUTH_URL` |
| `GOOGLE_CLIENT_ID` | Yes* | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Yes* | Google OAuth |
| `GITHUB_CLIENT_ID` | Yes* | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | Yes* | GitHub OAuth |
| `ENCRYPTION_KEY` | Yes | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CRON_SECRET` | Yes | Protects `/api/cron/*` endpoints |
| `SMTP_HOST` | No | Brevo SMTP for magic link emails |
| `SMTP_PORT` | No | Default: `587` |
| `SMTP_USER` | No | Brevo SMTP user |
| `SMTP_PASS` | No | Brevo SMTP password |
| `RAPIDAPI_KEY` | No | JSearch API key |
| `ADZUNA_APP_ID` | No | Adzuna API credentials |
| `ADZUNA_APP_KEY` | No | Adzuna API credentials |
| `SERPAPI_KEY` | No | Google Jobs via SerpAPI |
| `GROQ_API_KEY` | No | AI cover letter generation |
| `BLOB_READ_WRITE_TOKEN` | No | Vercel Blob for resume storage |
| `ADMIN_EMAILS` | No | Comma-separated admin emails (OAuth access) |
| `ADMIN_USERNAME` | No | Standalone admin login username |
| `ADMIN_PASSWORD` | No | Standalone admin login password |

*At least one OAuth provider is required for sign-in.

### Docker (Optional)

For local development with PostgreSQL, Redis, and n8n:

```bash
docker compose up -d
```

This starts PostgreSQL on `:5432`, n8n on `:5678`, and the app on `:3000`.

## Project Structure

```
src/
  app/
    (dashboard)/          # Authenticated user pages
      dashboard/          # Kanban board + status banner
      recommended/        # AI-scored job recommendations
      jobs/[id]/          # Job detail + quick apply
      applications/       # Application queue with bulk operations
      analytics/          # Charts, stats, keyword effectiveness
      settings/           # User configuration (lazy-loaded tabs)
      resumes/            # Resume management + AI rephrase
      templates/          # Email templates
      system-health/      # System health monitoring
    (admin)/admin/        # Admin panel
      scrapers/           # Scraper management
      users/              # User management
      logs/               # System logs
      feedback/           # User feedback management
    api/
      cron/               # Scheduled tasks (scrape, match, send, follow-up, cleanup)
      admin/              # Admin API (stats, scrapers, users, logs, jobs, quotas, feedback)
      jobs/generate-pitch/ # AI pitch + cover letter generation (on-demand)
      applications/       # Application CRUD, sending, bulk operations
      resumes/            # Resume upload + preview
      email/              # Test email endpoint
      webhooks/           # Bounce detection webhooks
      extension/          # Browser extension API (planned)
  components/
    kanban/               # Drag-and-drop board
    jobs/                 # Job detail, quick apply, QuickApplyKit, forms
    applications/         # Application queue, sending status
    analytics/            # Charts, stats, keyword effectiveness, speed metrics
    settings/             # Settings form (code-split by tab)
    dashboard/            # Status banner, bulk actions bar, TodaysQueue, DeliveryStats
    onboarding/           # Guided setup wizard (lazy-loaded)
    admin/                # Admin components
    layout/               # Sidebar, header
    shared/               # Skeletons, badges, copy helpers, feedback widget, activity tracker
  lib/
    scrapers/             # 8 job source integrations
    matching/             # Score engine, recommendation engine, resume matcher
    ai/                   # Groq-powered email/cover letter generation
    email.ts              # SMTP transporter with connection pooling + caching
    email-extractor.ts    # Company email extraction with confidence scoring
    email-errors.ts       # SMTP error classification (permanent/transient/rate_limit/auth/network)
    send-limiter.ts       # Rate limiting, bounce detection, email warmup
    send-application.ts   # Application sending with 8-layer safety
    encryption.ts         # AES-256 SMTP password encryption
    prisma.ts             # Prisma client (dev query logging enabled)
    auth.ts               # NextAuth configuration
    admin.ts              # Admin access helpers
```

## Cron Endpoints

These run on a schedule (e.g. via Vercel Cron or cron-job.org). All require `CRON_SECRET` header.

| Endpoint | Purpose |
|---|---|
| `/api/cron/scrape-global` | Scrape all 8 job sources (aggregated keywords) |
| `/api/cron/scrape/[source]` | Scrape a specific source |
| `/api/cron/match-all-users` | Match fresh jobs to all user profiles |
| `/api/cron/match-jobs` | Match jobs for a specific user |
| `/api/cron/instant-apply` | Match + auto-draft/send for Full-Auto/Instant users |
| `/api/cron/send-queued` | Send applications in READY status |
| `/api/cron/send-scheduled` | Send scheduled applications past their send time |
| `/api/cron/follow-up` | Send follow-up emails |
| `/api/cron/check-follow-ups` | Find applications sent 7+ days ago, draft follow-ups |
| `/api/cron/notify-matches` | Email notifications for new matches |
| `/api/cron/cleanup-stale` | Archive old inactive jobs |

## Performance Optimizations

The application includes several performance optimizations:

- **Scraper parallelization** &mdash; All scrapers run in parallel via `Promise.allSettled` instead of sequentially. Eliminates the 50-second timeout bottleneck where a single source (e.g., LinkedIn) could consume most of the budget.
- **Parallel data fetching** &mdash; Dashboard and other pages use `Promise.all` to load data concurrently instead of sequentially
- **Settings caching** &mdash; `getSettings()` cached with React `cache()` + `unstable_cache` (5-minute TTL) since it's called on every page
- **Lightweight settings** &mdash; `getSettingsLite()` with `select` for pages that only need a subset of fields
- **DB connection pooling** &mdash; Neon pooler with `pgbouncer=true` and `connection_limit=5`
- **Region alignment** &mdash; Vercel functions co-located with Neon DB region (`iad1`)
- **Query optimization** &mdash; `select` on job detail and activities queries to avoid loading full descriptions in lists
- **Code-split SettingsForm** &mdash; 2,300-line form lazy-loaded via `next/dynamic`; only active tab renders
- **Lazy-loaded components** &mdash; Charts (recharts), OnboardingWizard, and TemplateEditor dynamically imported
- **SMTP connection pooling** &mdash; Transporter cached per user with `pool: true` and 10-minute TTL
- **Prisma query logging** &mdash; Enabled in development for identifying slow queries

## Deployment

Works out of the box on [Vercel](https://vercel.com):

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Vercel auto-runs `prisma generate` via `postinstall`
5. Set function region to match your Neon DB (e.g. `iad1` for us-east-1)
6. Set up cron-job.org (free) to trigger `/api/cron/*` endpoints on schedule

## Roadmap

See the product strategy for planned features:

- **Fast Manual Apply** &mdash; "Apply on Site" as primary action, copy-to-clipboard kit, daily application queue
- **Application Tracking** &mdash; Track all applications (email, site, LinkedIn, referral) in one dashboard
- **Browser Extension** &mdash; Chrome extension for match scoring and one-click apply on LinkedIn/Indeed
- **Weekly Reports** &mdash; Automated email with performance stats, keyword suggestions, resume gaps
- **Daily Digest** &mdash; Morning email with top matches and auto-apply results

## License

MIT
