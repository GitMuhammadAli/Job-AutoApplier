# JobPilot

Automated job application tracker that scrapes jobs from 8 sources, matches them to your profile, generates personalized emails with AI, and sends them on your behalf.

**Stack:** Next.js 14 (App Router) &bull; TypeScript &bull; Tailwind CSS &bull; shadcn/ui &bull; PostgreSQL &bull; Prisma &bull; NextAuth.js &bull; Groq AI

## Features

- **Kanban board** with drag-and-drop (Saved, Applied, Interview, Offer, Rejected, Ghosted)
- **8 job sources** &mdash; Indeed, Remotive, Arbeitnow, LinkedIn, Rozee, JSearch, Adzuna, Google Jobs
- **Smart matching** &mdash; keyword, category, location, experience, salary, and resume-skill scoring
- **AI email generation** &mdash; personalized subject, body, and cover letter via Groq (Llama)
- **3 application modes** &mdash; Manual (copy/paste), Semi-Auto (AI prepares, you review), Full-Auto (hands-free)
- **Email sending** &mdash; Gmail, Outlook, or custom SMTP with rate limiting, bounce detection, and cooldowns
- **Resume management** &mdash; upload PDF/DOCX, auto-detect skills, match resumes to jobs by category
- **Email templates** &mdash; customizable with `{{company}}`, `{{position}}`, `{{name}}` placeholders
- **Analytics dashboard** &mdash; applications over time, source breakdown, score distribution, response rates
- **Admin panel** &mdash; system stats, API quotas, scraper health, user management, log viewer
- **Dark mode** &mdash; full dark/light/system theme support
- **Onboarding wizard** &mdash; 7-step guided setup with validation

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
      page.tsx            # Kanban board
      jobs/[id]/          # Job detail + quick apply
      applications/       # Application queue
      analytics/          # Charts and stats
      settings/           # User configuration
      resumes/            # Resume management
      templates/          # Email templates
    (admin)/admin/        # Admin panel
    api/
      cron/               # Scheduled tasks (scrape, match, send, follow-up)
      admin/              # Admin API routes
      applications/       # Application CRUD + sending
      resumes/            # Resume upload + preview
      email/              # Test email endpoint
  components/
    kanban/               # Drag-and-drop board
    jobs/                 # Job detail, quick apply, forms
    applications/         # Application queue, sending status
    analytics/            # Charts, stats, comparisons
    settings/             # Settings form
    onboarding/           # 7-step wizard
    admin/                # Admin components
    layout/               # Sidebar, header
    shared/               # Skeletons, badges, copy helpers
  lib/
    scrapers/             # 8 job source integrations
    matching/             # Score engine
    ai/                   # Groq-powered email generation
    send-limiter.ts       # Rate limiting + bounce detection
    encryption.ts         # SMTP password encryption
    auth.ts               # NextAuth configuration
    admin.ts              # Admin access helpers
```

## Cron Endpoints

These run on a schedule (e.g. via Vercel Cron or external scheduler). All require `CRON_SECRET` header.

| Endpoint | Purpose |
|---|---|
| `/api/cron/scrape-global` | Scrape all 8 job sources |
| `/api/cron/match-all-users` | Match new jobs to all user profiles |
| `/api/cron/send-queued` | Send queued applications |
| `/api/cron/instant-apply` | Auto-apply for Full-Auto users |
| `/api/cron/follow-up` | Generate follow-up emails |
| `/api/cron/check-follow-ups` | Check for stale follow-ups |
| `/api/cron/notify-matches` | Email notifications for new matches |
| `/api/cron/cleanup-stale` | Archive old inactive jobs |

## n8n Workflows

Optional automation workflows in `n8n/workflows/`:

1. **Job Scraper** &mdash; Trigger scraping via webhook
2. **Follow-up Reminder** &mdash; Remind about unanswered applications
3. **Ghost Detector** &mdash; Flag applications with no response after 14 days
4. **Weekly Digest** &mdash; Summary email of the week's activity
5. **LinkedIn RSS Monitor** &mdash; Watch LinkedIn job feeds

Import these into n8n after running `docker compose up -d`.

## Deployment

Works out of the box on [Vercel](https://vercel.com):

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Vercel auto-runs `prisma generate` via `postinstall`
5. Set up Vercel Cron for scheduled endpoints (see `vercel.json`)

## License

MIT
