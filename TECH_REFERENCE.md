# JobPilot — Complete Technology & Package Reference

Everything used in the project, why it was chosen, what it replaces, and where it's used.

---

## 1. CORE FRAMEWORK & LANGUAGE

| Package | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **Next.js 14** | Full-stack React framework with server-side rendering, API routes, server actions | **WHY:** Server Components = less JS shipped to browser (critical for mobile users). Vercel-native = zero-config deployment, same company. App Router + Server Actions = call backend directly from components without writing API routes. Remix/Nuxt would require different deployment story. | Remix (good but smaller ecosystem, different hosting), Nuxt (Vue not React), Express+React (wire everything manually), T3 Stack (uses Next.js anyway) | Entire app — every page, every API route, every server action |
| **TypeScript 5 (strict mode)** | Adds types to JavaScript — catches bugs before runtime | Prisma generates types from schema → when you query `userJob.matchScore` TypeScript knows it's `Float?`. Without TS you'd get runtime crashes from typos. Strict mode catches even more. | JavaScript (no type safety), Flow (dead), ReScript (too niche) | Every `.ts` and `.tsx` file |
| **React 18** | UI library — components, hooks, state management | Comes with Next.js. Largest ecosystem. Every UI library we use (shadcn, dnd-kit, recharts) is React-based. | Vue.js (different ecosystem), Svelte (smaller community), Solid.js (too new) | All components in `src/components/` |

---

## 2. STYLING & UI COMPONENTS

| Package | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **Tailwind CSS 3** | Utility-first CSS — write styles as class names directly on HTML | No CSS files to manage. No class naming. `className="bg-blue-500 text-white p-4 rounded"` is faster than writing CSS. Purges unused styles → tiny final CSS. | CSS Modules (separate files), Styled Components (CSS-in-JS, heavier), Bootstrap (opinionated, bloated), Sass (still need file management) | Every component's `className` props |
| **shadcn/ui** | Pre-built accessible UI components (Button, Dialog, Dropdown, Toast, Tabs, etc.) | **WHY:** Code ownership — copies component code into YOUR repo. You own it, you can edit it. Material UI = 300KB+ and hard to customize. shadcn = 0KB runtime (Tailwind only), fully customizable. Accessible by default (keyboard nav, screen readers). Built on Radix UI primitives. | Material UI (heavy, 300KB+, hard to customize), Ant Design (Chinese-first docs), Chakra UI (runtime CSS-in-JS, slower), Headless UI (less components) | `src/components/ui/` — Button, Dialog, DropdownMenu, Input, Select, Tabs, Badge, Card, Toast, Checkbox, Switch, Progress, Popover, Tooltip, etc. |
| **Radix UI** | Headless UI primitives — 12 packages installed | shadcn/ui is built ON TOP of Radix. Handles complex accessibility: focus trapping, keyboard navigation, ARIA attributes. You never use Radix directly. | React Aria (Adobe, more verbose), Headless UI (fewer components) | Under the hood of shadcn/ui components |
| **lucide-react** | Icon library — 1000+ SVG icons as React components | Lightweight, tree-shakeable (only imports icons you use). `<Search />`, `<Mail />`, `<Briefcase />`. Consistent style. | React Icons (bundle all icon sets = bloated), Heroicons (fewer icons), Font Awesome (heavy, needs CSS) | Icons throughout the UI — sidebar nav, buttons, status badges, source icons |
| **sonner** | Toast notification library | The best-looking toast in React ecosystem. One line: `toast.success("Application sent!")`. Stacks, auto-dismisses, supports actions. | react-hot-toast (good but less features), react-toastify (ugly defaults, needs CSS overrides), shadcn Toast (more verbose) | Copy-to-clipboard confirmations, send success/failure, save confirmations, bulk operation progress |
| **class-variance-authority** | Component variant utility — define button sizes, colors as variant objects | Used by shadcn/ui to define component variants like `variant="outline"`, `size="sm"`. Clean API for conditional class names. | Manual `clsx` conditionals (verbose) | `src/components/ui/` component variant definitions |
| **clsx + tailwind-merge** | className merging and Tailwind class deduplication | `clsx` conditionally joins class names. `tailwind-merge` resolves conflicts (`p-2 p-4` → `p-4`). Combined in `cn()` utility. | classnames (no Tailwind dedup), manual string concatenation | `src/lib/utils.ts` → used everywhere via `cn()` helper |
| **tailwindcss-animate** ^1.0.7 | Animation utilities for Tailwind | Adds classes like `animate-slide-up`, `animate-fade-in`. Used for page transitions and component entrance animations. | CSS @keyframes (manual), framer-motion (heavier) | Page transitions, dialog animations |
| **next-themes** | Dark mode / theme toggle for Next.js | Handles system preference detection, theme persistence, SSR hydration mismatch prevention. One component: `<ThemeProvider>`. | Manual CSS variables + localStorage (error-prone, hydration issues) | Theme toggle in sidebar, applied app-wide |
| **react-day-picker** | Date picker component | Used for scheduling send times and follow-up dates. Clean, accessible, customizable with Tailwind. | react-datepicker (older, less accessible), date-fns date picker (doesn't exist) | Scheduled send time picker in application queue |

---

## 3. DATABASE & ORM

| Package | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **PostgreSQL (via Neon)** | Relational database — stores all application data | **WHY:** Relational = can JOIN GlobalJob + UserJob + Application in one query. MongoDB can't do efficient joins — user→job→application chains would require N+1 queries. PostgreSQL supports arrays (skills[], keywords[]) and JSON columns (detectedSkills, matchReasons). Neon = serverless PostgreSQL that sleeps when unused = $0 free tier (0.5GB). | MySQL (no array support), MongoDB (bad for relational data), Supabase (adds SDK lock-in), PlanetScale (MySQL-based, no foreign keys) | All data: users, jobs, resumes, applications, settings, activities, system logs |
| **Prisma ORM 5** | Database toolkit — schema definition, migrations, type-safe queries | Write schema in `.prisma` file → Prisma generates TypeScript types + migration SQL. `prisma.userJob.findMany()` returns fully typed objects. Auto-completes in your editor. Supports JSON fields for flexible data. | Drizzle ORM (newer, less documentation), Knex.js (query builder, no schema), TypeORM (heavy, decorator-based), raw SQL (no type safety) | `src/lib/prisma.ts` + every server action and API route that touches the database |
| **@prisma/client** | Auto-generated database client from your Prisma schema | Installed automatically when you run `npx prisma generate`. Gives you `prisma.globalJob.findMany()`, `prisma.userJob.create()`, etc. | N/A — comes with Prisma | Every database query in the project |

---

## 4. AUTHENTICATION

| Package | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **NextAuth.js v4** | Authentication library — handles OAuth (Google, GitHub) + email magic links | Built for Next.js. Handles OAuth flow (redirect → callback → session) automatically. PrismaAdapter syncs auth data with your database. Session management built-in. Free. | Clerk (easier but $25/month after 10K users), Auth0 (complex, expensive), Supabase Auth (ties you to Supabase), Lucia (newer, less documentation), NextAuth v5 (still beta, breaking changes) | `src/app/api/auth/[...nextauth]/route.ts` + `src/lib/auth.ts` |
| **@next-auth/prisma-adapter** | Connects NextAuth to your Prisma database | Auto-manages User, Account, Session, VerificationToken tables. When user logs in with Google, it creates/updates Account record automatically. | Write adapter manually (500+ lines of code) | Config inside NextAuth options |

---

## 5. STATE MANAGEMENT

| Package | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **Zustand 4** | Client-side state management — shared state across components | **WHY:** 10x less boilerplate than Redux. No Provider wrapper. No actions/reducers/selectors. `const jobs = useJobStore(state => state.jobs)`. Perfect for optimistic updates (update UI immediately, sync with server after). 1.1KB gzipped. Redux Toolkit = 100x more code for same result. | Redux Toolkit (100x more boilerplate), Jotai (atom-based, different mental model), React Context (re-renders everything), Recoil (Facebook, dying) | `src/store/useJobStore.ts` (Kanban state), `src/store/useApplicationStore.ts` (application queue) |
| **SWR 2** | Data fetching with caching, revalidation, and stale-while-revalidate | Automatic caching, deduplication, and background revalidation. `useSWR('/api/jobs', fetcher)` handles loading/error states. | React Query (heavier, similar capability), manual useEffect+useState (boilerplate) | Client-side data fetching for dashboard, analytics, real-time status |

---

## 6. DRAG & DROP

| Package | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **@dnd-kit/core 6** | Drag and drop framework for React | Most accessible DnD library — works with keyboard, screen readers. Modern API (hooks-based). Supports multiple drop zones (Kanban columns). Performant with many items. | react-beautiful-dnd (deprecated by Atlassian), react-dnd (complex API, HTML5 backend issues on mobile), pragmatic-drag-and-drop (Atlassian's new one, less community) | `src/components/kanban/KanbanBoard.tsx` — DndContext wraps columns |
| **@dnd-kit/utilities 3** | CSS transform utilities for smooth drag animations | Provides `CSS.Transform.toString()` for smooth card movement during drag. | Write transform math manually | Kanban drag animations |

---

## 7. CHARTS & ANALYTICS

| Package | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **Recharts 2** | React charting library — line, bar, pie, donut charts | Built for React (uses React components, not canvas). Simple API: `<LineChart data={data}><Line dataKey="count" /></LineChart>`. Responsive. | Chart.js (canvas-based, not React-native), Nivo (heavier), Victory (Formidable, good but more verbose), D3 (low-level, build everything from scratch), Tremor (nice but adds Tailwind-specific dependency) | `src/components/analytics/AnalyticsDashboard.tsx` — applications over time, stage breakdown, source distribution, match score histogram, method pie, sent vs failed, top categories |

---

## 8. AI / LLM

| Package | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **Groq API (direct fetch)** | LLM API — sends prompts, gets AI-generated text | **WHY:** 14,400 requests/day FREE vs OpenAI $0.002/request (would be ~$36/month at 600 req/day). Response in <1 second (fastest LLM inference). Model: `llama-3.1-8b-instant` for email writing. We use direct `fetch()` to the Groq OpenAI-compatible endpoint — no SDK overhead. **WHY direct fetch over groq-sdk:** Lighter bundle, full retry control, no SDK bloat. `groq-sdk` is in package.json but unused; our wrapper in `src/lib/groq.ts` handles retries + timeouts natively. Non-200 errors include actual error body (first 200 chars) in thrown errors for debuggability. | OpenAI (expensive: $0.002/request adds up), Anthropic Claude API (expensive), Ollama (self-hosted, needs server), Google Gemini (rate limits, less reliable) | `src/lib/groq.ts` → called by: email generation, cover letter generation, AI pitch + cover letter (generate-pitch API), resume AI rephrase, resume matching tiebreaker |

---

## 9. EMAIL

| Package | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **Nodemailer 8** | Sends emails via SMTP from Node.js | Industry standard. Works with ANY SMTP provider (Gmail, Outlook, Brevo, custom). Supports attachments (resume PDFs). HTML email bodies. Multi-provider support in one codebase. System transporter not cached when env creds missing (prevents permanently broken transporter). | SendGrid SDK (ties you to SendGrid), Resend (newer, $0 for 100/day then paid), AWS SES (complex setup), Postmark (paid) | `src/lib/email.ts` — four provider configs: Gmail, Outlook, custom SMTP, Brevo. `src/lib/send-application.ts` — sends individual applications with resume attachment; checks `hasDecryptionFailure()` before building transporter |
| **Brevo SMTP** (service, not package) | Email delivery service — sends system emails | 300 free emails/day. Reliable delivery. Provides bounce webhooks. Used ONLY for notification emails to the user, NOT for application emails to companies. | SendGrid (300/day free but aggressive spam filtering), Mailgun (5000/month free but credit card required), Amazon SES ($0.10/1000 but complex) | Notification emails ("12 new matches"), magic link login emails |
| **Gmail / Outlook / Custom SMTP** (service) | User's own email server — sends application emails | **WHY user's own SMTP over SendGrid/Brevo for applications:** Emails come from user's ACTUAL email → perfect deliverability (no "via brevo.com" warning). HR sees real Gmail/Outlook address. 500 emails/day free (Gmail). User configures their SMTP credentials in Settings. SendGrid/Brevo for applications = higher spam risk, domain verification hassle. | Brevo for everything (works but spam risk for application emails) | Application emails to HR, follow-up emails to companies |

---

## 10. FILE STORAGE

| Package | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **@vercel/blob 2** | File storage — upload, download, delete files via URL | Free 256MB on Vercel Hobby. Simple API: `put(path, buffer) → url`. Returns permanent public URL. No signed URLs needed. Vercel-native = zero config. | AWS S3 (complex setup, needs IAM), Cloudinary (image-focused), Supabase Storage (ties to Supabase), UploadThing (wrapper but adds dependency), store in DB as base64 (terrible for performance) | `src/app/api/resumes/upload/route.ts` — stores resume PDFs. URLs saved in `resume.fileUrl`. Downloaded when attaching to emails. |

---

## 11. RESUME PARSING & SKILL EXTRACTION

| Package | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **unpdf** ^1.4.0 | Primary PDF text extraction — serverless-optimized | Attempt 1 in resume parser. No canvas/worker deps — works on Vercel serverless. `extractText` + `getDocumentProxy` API. If it returns < 20 chars, falls back to pdf-parse. | pdf-parse (heavier), pdfjs-dist (worker setup complex on serverless) | `src/lib/resume-parser.ts` — Attempt 1 for PDF extraction |
| **pdf-parse 2** | Fallback PDF text extraction — fast, lightweight | Attempt 2. Version 2 uses `PDFParse` class API. Handles most standard PDFs. If it returns < 20 chars, falls back to pdfjs-dist. | Apache Tika (Java, heavy), textract (more dependencies), paid APIs like DocParser ($39/month) | `src/lib/resume-parser.ts` — Attempt 2 when unpdf yields < 20 chars |
| **pdfjs-dist 5** | Last-resort PDF text extraction — Mozilla's PDF.js | Attempt 3. Handles PDFs with custom font encodings, CMap tables, Type3 fonts. Configured with `cMapUrl`, `cMapPacked`, `standardFontDataUrl`, `disableFontFace`, `isEvalSupported: false` for server-side use. | Poppler (system dependency, not serverless-friendly), OCR with Tesseract (heavy, slow) | `src/lib/resume-parser.ts` — Attempt 3 when both unpdf and pdf-parse yield < 20 chars |
| **Custom skill extractor** | Extracts structured data from resume text | Not an npm package — custom code. Maps resume text against 200+ canonical skills with alias matching. Parses sections (summary, experience, education, skills, projects, certifications). Detects years of experience and education level. | Affinda API (paid), Sovren (paid), OpenAI for extraction (expensive) | `src/lib/skill-extractor.ts` + `src/constants/skills.ts` |

**Note:** Only PDF uploads are accepted. DOCX/TXT support was removed. `mammoth` is still in package.json but is unused — can be safely removed.

---

## 12. VALIDATION

| Package | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **Zod 3** | Runtime schema validation — checks data shape and types | TypeScript-first: `z.string().email()` validates AND infers TypeScript type. Works perfectly with Server Actions. Readable error messages. | Yup (older, less TS integration), Joi (heavier, not TS-first), class-validator (decorator-based, different paradigm), manual if/else checks (tedious, error-prone) | `src/app/actions/settings.ts` (settings validation), resume upload validation, template validation, onboarding validation, email output validation — every place user input touches the database |

---

## 13. UTILITIES

| Package | What It Does | Why This One | Where Used In Project |
|---------|-------------|-------------|----------------------|
| **date-fns 3** | Date formatting and manipulation | Lightweight, tree-shakeable. `format(date, 'MMM d')`, `formatDistanceToNow()`. No mutable Date objects like Moment.js. | Analytics date formatting, activity timestamps, job freshness display |
| **jszip 3** | ZIP file creation in the browser/server | Used for "Export All My Data" feature — bundles jobs, applications, resumes, templates into a downloadable ZIP. | Data export feature in Settings |
| **react-window** ^2.2.7 | Virtualized list rendering | Renders only visible rows for long lists — reduces DOM nodes and improves performance. | Large job lists, application queues |
| **web-push** ^3.6.7 | Web Push API for browser notifications | Sends push notifications to subscribed clients. | Push notification support |

---

## 14. SCHEDULING (EXTERNAL SERVICE)

| Service | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **cron-job.org** | External cron scheduler — hits your URLs on a schedule | **WHY cron-job.org over Vercel Cron:** Vercel Hobby = 1 cron job limit + 10s function timeout = useless for scrape/match/send pipelines. cron-job.org = free, unlimited jobs, any frequency. Dashboard UI. No code changes to adjust schedule. No server to maintain. **10 crons total:** free scrapers every 2h (`mode=free`), paid scrapers daily 6AM (`mode=paid`), matching hourly, instant-apply every 30min, send-queued/send-scheduled every 5min, daily maintenance. | Vercel Cron (1 job limit, 10s timeout on Hobby = useless), QStash by Upstash (100/day free then paid), GitHub Actions (complex, not real cron), Railway cron (needs separate deploy), self-hosted cron server ($5/month VPS) | Triggers scrape, match, send, follow-up, cleanup, and notification cron routes |

---

## 15. DNS / EMAIL VERIFICATION

| Service/API | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **dns.google/resolve** | Google's public DNS API — checks if a domain has MX records | Free. No auth needed. Simple GET request: `dns.google/resolve?name=techcorp.com&type=MX`. If MX records exist → domain can receive email → our pattern-matched email (careers@techcorp.com) might be valid. | Node's `dns.resolveMx()` (works but blocked on some serverless platforms), Hunter.io API (paid after 25/month), ZeroBounce (paid) | `src/lib/email-verifier.ts` — part of the email extraction chain |

---

## 16. DEPLOYMENT & HOSTING

| Service | What It Does | Why This One | What We Could Have Used Instead | Where Used In Project |
|---------|-------------|-------------|-------------------------------|----------------------|
| **Vercel (Hobby plan)** | Hosts the Next.js app — serverless functions, edge network, auto-deploy from GitHub. vercel.json has no crons configured; all scheduling is via cron-job.org. | Free. Built for Next.js (same company). Push to GitHub → auto-deploys in 30 seconds. Serverless functions for API routes. Global CDN for static assets. 100GB bandwidth/month free. **Real constraint:** 10s function timeout on Hobby. | Railway (free tier limited), Netlify (Next.js support is worse), AWS Amplify (complex), Render (cold starts), self-hosted VPS ($5/month, manual everything) | Entire application — frontend, API routes, server actions, cron route handlers |
| **Neon** | Serverless PostgreSQL database | **WHY Neon over Supabase:** Serverless scaling, $0 free tier (0.5GB), no SDK lock-in. Supabase adds full SDK and ties you to their ecosystem. Neon = plain PostgreSQL with connection pooler. Auto-sleep when unused = $0. **Real constraint:** 0.5GB free tier. | Supabase (good but adds full SDK), PlanetScale (MySQL not PostgreSQL), Railway Postgres (limited free tier), CockroachDB (overkill), local PostgreSQL (can't use in serverless) | `DATABASE_URL` in env → Prisma connects to it |
| **GitHub** | Code repository + CI trigger | Push to main → Vercel auto-deploys. Pull request previews. Free unlimited private repos. | GitLab (heavier), Bitbucket (fewer integrations) | Source code hosting, deployment trigger |

---

## 17. TESTING & DEVELOPMENT TOOLS (dev dependencies)

| Package | What It Does | Why This One | Where Used |
|---------|-------------|-------------|------------|
| **eslint 8** | Lints JavaScript/TypeScript — catches code quality issues | Comes with Next.js. Enforces consistent code style. | `npm run lint` |
| **eslint-config-next** | Next.js-specific ESLint rules | Catches Next.js-specific issues (missing Image alt, incorrect Link usage) | ESLint config |
| **prisma (CLI) 5** | Database migrations, schema push, studio | `npx prisma db push` pushes schema. `npx prisma studio` opens DB browser. | Schema changes, DB management |
| **tsx** | TypeScript execution — run .ts files directly | Used for one-off scripts: `npx tsx src/scripts/fix-json-emails.ts`. No compilation step needed. | Test scripts, database cleanup scripts, debug scripts |
| **@playwright/test** | End-to-end browser testing | Full browser automation for testing the complete user flow. | Integration testing |
| **@types/node** | TypeScript types for Node.js APIs | Needed for `Buffer`, `process.env`, `fetch` types | Everywhere server-side |
| **@types/nodemailer** | TypeScript types for Nodemailer | Needed for `SendMailOptions`, `Transporter` types | Email sending code |
| **autoprefixer + postcss** | CSS processing pipeline | Required by Tailwind CSS for vendor prefixing | Build pipeline |

---

## PRODUCTION REALITY CHECK (as of backfill)

| Metric | Value | Notes |
|--------|-------|-------|
| Total jobs | 10,620 | After backfill |
| Jobs with emails | 103 | 1.0% — most jobs don't have company email |
| LinkedIn share | 83% | Dominant source but 0% descriptions (API limitation) |
| Emails sent | 19 | |
| Bounce rate | 0% | 100% delivery |
| Users | 4 | |
| Users with SMTP configured | 1 | |
| Groq usage | Direct fetch | Not groq-sdk — lighter, full retry control |

---

## EMAIL EXTRACTION FROM TEXT (extract-email-from-text.ts)

| Feature | Description | Where Used |
|---------|-------------|------------|
| **Purpose** | Extracts company emails from job description text during scrape. Used when job has `description` but no pre-extracted email. Regex finds all emails, filters excluded domains (gmail, linkedin, etc.) and excluded prefixes (noreply, support, etc.), scores by hiring-prefix preference. | `src/lib/extract-email-from-text.ts`, `src/lib/scrapers/scrape-source.ts`, `src/app/api/cron/scrape-global/route.ts` |
| **Scoring** | Base score 85. +10 for hiring prefixes (hr, careers, jobs, hiring, apply, etc.). -10 for personal pattern (firstname.lastname). Capped at 95. | `extractEmailFromText()` |
| **Output** | `{ email: string \| null, confidence: number }` — confidence 85–95 for description_text extractions. | Scrape pipeline, backfill-emails |
| **Relation to email-extractor.ts** | `extract-email-from-text.ts` = sync, text-only, used during scrape. `email-extractor.ts` = async, does careers page scrape + MX/RCPT verification, used at apply-time. | Both feed into `GlobalJob.companyEmail` + `emailConfidence` |

---

## CRON TRACKER (cron-tracker.ts)

| Feature | Description | Where Used |
|---------|-------------|------------|
| **Purpose** | Standardized cron run outcome logging via SystemLog. Every cron uses `createCronTracker(cronName)` at the top and calls `.success()`, `.error()`, or `.skipped()` before returning. | `src/lib/cron-tracker.ts` |
| **Log format** | `type="cron-run"`, `source=cronName`, message with [OK]/[ERR]/[SKIP], metadata: status, durationMs, processed, failed, reason. | All cron route handlers |
| **Admin visibility** | Admin panel queries these records to show cron health, last run, durations. Single retry (500ms) on transient DB write failure. | Admin dashboard cron status |
| **Usage** | `const tracker = createCronTracker("send-scheduled");` … `await tracker.success({ processed: 5 });` or `await tracker.error(err);` or `await tracker.skipped("Lock held");` | `send-scheduled`, `send-queued`, `instant-apply`, `match-all-users`, `scrape-global`, etc. |

---

## FRESHNESS INDICATOR (FreshnessIndicator component)

| Feature | Description | Where Used |
|---------|-------------|------------|
| **Purpose** | Shows job freshness based on `lastSeenAt` or `firstSeenAt`. Helps users prioritize recent postings. | `src/components/jobs/FreshnessIndicator.tsx` |
| **States** | **Fresh** (<24h) — green. **X days ago** (24–72h) — amber. **X days ago — may be filled** (72h–7d) — orange. **X days ago — likely expired** (>7d) — red. **Deactivated** — gray when source is inactive. | Job detail page, Kanban cards |
| **FreshnessDot** | Compact dot-only variant: green ● / yellow ● / orange ● / red ● by same time thresholds. Colored dot prefix on freshness badges (e.g., "● Fresh", "● 2d ago"). Used in lists where space is limited. | `JobCard`, `ApplicationQueue`, recommended page |
| **Props** | `lastSeenAt`, `firstSeenAt`, `isActive` (for deactivated state). | Job detail client, Kanban JobCard, ApplicationQueue |

---

## COMPLETE DEPENDENCY LIST (package.json)

### dependencies (shipped to production)
```json
{
  "next": "14.2.0",
  "react": "18.3.0",
  "react-dom": "18.3.0",

  "tailwindcss": "^3.4.0",
  "tailwindcss-animate": "^1.0.7",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.6.1",
  "lucide-react": "^0.400.0",
  "sonner": "^1.7.4",
  "next-themes": "^0.4.6",
  "react-day-picker": "^9.13.2",

  "@radix-ui/react-alert-dialog": "^1.1.15",
  "@radix-ui/react-dialog": "^1.1.15",
  "@radix-ui/react-dropdown-menu": "^2.1.16",
  "@radix-ui/react-label": "^2.1.8",
  "@radix-ui/react-popover": "^1.1.15",
  "@radix-ui/react-progress": "^1.1.8",
  "@radix-ui/react-select": "^2.2.6",
  "@radix-ui/react-separator": "^1.1.8",
  "@radix-ui/react-slot": "^1.2.4",
  "@radix-ui/react-switch": "^1.2.6",
  "@radix-ui/react-tabs": "^1.1.13",
  "@radix-ui/react-tooltip": "^1.2.8",

  "@prisma/client": "5.20.0",
  "@next-auth/prisma-adapter": "1.0.7",
  "next-auth": "4.24.13",
  "@vercel/blob": "^2.2.0",

  "zustand": "^4.5.0",
  "swr": "^2.4.0",

  "@dnd-kit/core": "^6.1.0",
  "@dnd-kit/utilities": "^3.2.0",

  "recharts": "^2.12.0",
  "date-fns": "^3.6.0",
  "jszip": "^3.10.1",

  "groq-sdk": "^0.37.0",

  "nodemailer": "8.0.1",

  "pdf-parse": "^2.4.5",
  "pdfjs-dist": "^5.4.624",
  "unpdf": "^1.4.0",
  "mammoth": "^1.11.0",

  "react-window": "^2.2.7",
  "web-push": "^3.6.7",

  "zod": "^3.23.0"
}
```

### devDependencies (development only)
```json
{
  "prisma": "5.20.0",
  "tsx": "^4.15.0",
  "typescript": "^5.5.0",
  "@types/node": "^20.14.0",
  "@types/react": "^18.3.0",
  "@types/react-dom": "^18.3.0",
  "@types/nodemailer": "^7.0.10",
  "@types/react-window": "^1.8.8",
  "@types/web-push": "^3.6.4",
  "eslint": "^8.57.0",
  "eslint-config-next": "^14.2.0",
  "autoprefixer": "^10.4.0",
  "postcss": "^8.4.0",
  "tailwindcss": "^3.4.0",
  "@playwright/test": "^1.58.2"
}
```

**Note:** `mammoth` and `groq-sdk` are in package.json but not actively used in code. `mammoth` was replaced by PDF-only uploads. `groq-sdk` was replaced by a direct `fetch` wrapper in `src/lib/groq.ts`. Both can be safely removed to reduce bundle size.

---

## EXTERNAL SERVICES (not npm packages)

| Service | What It Is | Cost | Limit | What It Does In Our Project | Account Setup |
|---------|-----------|------|-------|---------------------------|---------------|
| **Vercel** | App hosting | $0 (Hobby) | 100GB bandwidth, 10s function timeout | Hosts entire app. Auto-deploys from GitHub. | vercel.com → import GitHub repo |
| **Neon** | PostgreSQL database | $0 (free tier) | 0.5GB storage | Stores all data. Serverless = scales automatically. | neon.tech → create project → copy DATABASE_URL |
| **Brevo** | Email delivery | $0 (free) | 300 emails/day | Sends notification emails to users + magic link login | brevo.com → signup → SMTP settings → copy credentials |
| **Groq** | AI / LLM API | $0 (free) | 14,400 req/day | Generates application emails, cover letters, resume rephrase, matching tiebreaker | console.groq.com → create API key |
| **cron-job.org** | Cron scheduler | $0 (free) | Unlimited jobs | Triggers cron URLs on schedule | cron-job.org → create jobs → paste URLs |
| **RapidAPI** | API marketplace | $0 (basic) | 200 req/month (JSearch) | JSearch job search API | rapidapi.com → subscribe to JSearch → copy API key |
| **Adzuna** | Job search API | $0 (free) | 200 req/day | Structured job data with salaries | developer.adzuna.com → register app → copy app_id + app_key |
| **SerpAPI** | Google search API | $0 (free) | 100 req/month | Google Jobs results | serpapi.com → signup → copy API key |
| **Google Cloud** | OAuth provider | $0 | Unlimited | "Sign in with Google" button | console.cloud.google.com → create OAuth credentials |
| **GitHub** | OAuth provider + hosting | $0 | Unlimited | "Sign in with GitHub" button + code hosting | github.com → Settings → Developer → OAuth App |
| **Google DNS** | DNS lookup API | $0 | Unlimited | MX record verification for email validation | No setup — public API at dns.google/resolve |

---

## WHAT EACH TECHNOLOGY DOES DURING THE COMPLETE FLOW

Here's a single job's journey from scraping to sending, showing which technology handles each step:

```
STEP 1: SCRAPING
  cron-job.org → hits /api/cron/scrape-global
  Next.js API Route → handles the request
  Promise.allSettled → runs all scrapers in parallel; one failure doesn't block others
  fetch() (built-in) → calls Remotive API, Indeed RSS, JSearch, Adzuna, SerpAPI, etc.
  extract-email-from-text.ts → extracts emails from job description (85–95 confidence)
  Prisma → upserts GlobalJob into Neon PostgreSQL

  Scraper parameters (boosted):
    JSearch: num_pages=2, 3 cities per keyword, 8 queries max
    Indeed: 8 queries, num_pages=2, 3 cities per query
    Adzuna: 8 queries, 3 pages, 50 results/page, 14 days
    Google Jobs: 5 queries, 3 cities, daily
    Rozee: 5 queries, daily (no longer alternates with Google)
    Remotive: limit=200, word-boundary matching for short keywords (≤3 chars)
    Arbeitnow: 3 pages
    LinkedIn Posts: Google search for hiring posts (site:linkedin.com/posts), 3 queries, daily

  Scraper runner: default timeout 8s (aligned with Vercel 10s limit)
    Fallback scraper skipped if <1s remains (prevents hard-kill)

  Stack acronym expansion:
    MERN/MEAN/PERN/LAMP/T3 in job text → expands to component technologies
    e.g. "MERN Developer" matches users with "react", "node.js", "mongodb" keywords

STEP 2: MATCHING
  cron-job.org → hits /api/cron/match-all-users
  Prisma → queries GlobalJob (isFresh) + UserSettings + Resume (with detectedSkills)
  Custom score engine → 8 hard filters + 7 scoring factors → score 0-100
    Hard filters: platform, company blacklist, negative keywords, keyword match,
                  category, country (checks all location parts), city, salary
    Scoring factors: keyword (0-30), title (0-25), skill (0-20), category (0-10),
                     location (-15 to +10, neutral for remote when workType empty),
                     experience (-15 to +5, word-boundary matching for short keywords),
                     freshness (0-5)
  hasDecryptionFailure() → checks notificationEmail before sending match digest
  claimNotificationSlot() → atomic check+record to prevent concurrent double-sends
  Prisma → creates UserJob with matchScore and matchReasons

STEP 3: RESUME SELECTION
  Custom code (resume-matcher.ts) → Tier 1-2: category + skill match
  Groq API (via fetch) → Tier 3: AI tiebreaker (only if tied)
  Prisma → fetches resume data including detectedSkills

STEP 4: EMAIL GENERATION
  Groq API (via fetch) → llama-3.1-8b-instant generates personalized email (100-150 words)
  Custom JSON extraction → bulletproof subject/body parsing (handles malformed AI output)
  Custom signature builder → appends phone, LinkedIn, GitHub, Portfolio as clean contact block
  Zod → validates output format

STEP 5: EMAIL EXTRACTION (apply-time, when job has no email yet)
  extract-email-from-text.ts → used during scrape for description_text (85–95)
  email-extractor.ts → careers page scrape (80), pattern_guess_rcpt_verified (40)
  fetch() → calls dns.google/resolve for MX record check
  FreshnessIndicator / FreshnessDot → shows job age (Fresh / Xd ago / may be filled / likely expired)

STEP 6: SENDING
  hasDecryptionFailure() → checks SMTP credentials weren't corrupted by key rotation
  canSendNow() → 6-layer safety check (account, pause, warmup+provider, daily, hourly+cooldown, delay, bounce) — all limits read from each user's own UserSettings
  Email warmup → progressive limits for new SMTP accounts (day 1-3: 3/day, day 4-7: 8/day)
  @vercel/blob → downloads resume PDF as Buffer
    → On download failure → returns app to READY (not sent without resume)
  Nodemailer → connects to user's SMTP (Gmail/Outlook/custom)
  cleanJsonField → final safety scrub of subject/body before send
  Nodemailer → sends email with PDF attachment (plain text only — avoids spam triggers)
  Prisma → updates application status to SENT
  Inter-send delay uses each user's sendDelaySeconds setting (default 120s) between batch sends

STEP 7: NOTIFICATION
  Nodemailer → connects to Brevo SMTP (system transporter)
  Nodemailer → sends notification digest to user

STEP 8: USER VIEWS DASHBOARD
  Next.js Server Component → renders page on server
  Prisma → queries UserJobs + GlobalJobs (JOIN), filters blacklisted companies
  React → renders Kanban board
  FreshnessDot → shows job age indicator on cards
  @dnd-kit → enables drag and drop
  Zustand → manages client state for optimistic updates
  Tailwind + shadcn/ui → styles everything
  lucide-react → renders icons
  sonner → shows toast on drag completion

  UI hierarchy:
    "Apply on Site" = PRIMARY for most jobs (no email) on job cards and detail page
    "Draft Application" = PRIMARY when email exists
    "Email Apply" = secondary, only shown when email confidence >= 80
    Job detail page has "I Applied" button for manual tracking
    Dashboard has "Today's Queue" and "Delivery Stats" widgets

STEP 9: RESUME MANAGEMENT
  unpdf → primary text extraction (serverless-optimized)
  pdf-parse v2 → fallback when unpdf yields < 20 chars
  pdfjs-dist → last-resort extraction with CMap + standard fonts for complex PDFs
  Custom skill extractor → ParsedResume with sections, skills, yearsOfExperience
  Groq API → AI Rephrase rewrites resume content for better impact
  Prisma → stores content, detectedSkills, textQuality

STEP 10: ANALYTICS
  Prisma → groupBy queries for aggregations
  Recharts → renders charts
  date-fns → formats dates and time ranges
  Keyword effectiveness → per-keyword match/save/dismiss/apply counts
    Shows which keywords produce results and which to reconsider
    Component: KeywordEffectiveness (src/components/analytics/)

STEP 11: BOUNCE HANDLING
  Brevo webhook → hits /api/webhooks/email-bounce
  Prisma → marks application as BOUNCED
  Prisma → clears bad email from GlobalJob
```

---

## 18. ADMIN DASHBOARD

| Feature | Description | Where Used |
|---------|-------------|------------|
| **Admin Auth** | Two methods: OAuth (email in ADMIN_EMAILS) or credential login (ADMIN_USERNAME/PASSWORD). Credential sessions use httpOnly cookies with HMAC-SHA256 tokens (8h TTL). | `src/lib/admin.ts`, `src/lib/admin-auth.ts`, `src/app/api/admin/auth/route.ts` |
| **Dashboard** | Full system overview: 8 stat cards (users, jobs, pipeline), **recently active users grid** (avatar, online indicator, mode badge, relative timestamps, joined date), scraper health, job distribution by source, cron job status with trigger buttons, API quotas with progress bars, active system locks, recent errors (24h). | `src/app/(admin)/admin/page.tsx` |
| **Scrapers Page** | Dedicated scraper management: health badges, last run times, scrape stats, total jobs per source, error details, **collapsible "Recent runs" section per scraper card**, individual + bulk trigger buttons, Scrape Global support. **Removed:** "Scrape Posts" button (LinkedIn posts run inside scrape-global). | `src/app/(admin)/admin/scrapers/page.tsx` |
| **Users Page** | User management table: sortable columns (User, Sent Today, Total Apps, Last Active, Joined), online status indicators (green dot = active in last 5 min), relative timestamps, pause/activate/reset sending/delete actions. Shows online user count in header. | `src/app/(admin)/admin/users/page.tsx` |
| **Logs Page** | System logs viewer: filterable by type and source, paginated, expandable JSON metadata, color-coded type badges. | `src/app/(admin)/admin/logs/page.tsx` |
| **Feedback Page** | User feedback management: filter by status/type, expandable cards with full message, admin notes, status transitions (new → reviewed → resolved → dismissed). | `src/app/(admin)/admin/feedback/page.tsx` |
| **Trigger API** | Unified trigger endpoint for all scrapers (8 sources) and all cron actions (10 crons + backfill-emails). Calls internal cron routes with CRON_SECRET auth. | `src/app/api/admin/scrapers/trigger/route.ts` |
| **Stats API** | Aggregated dashboard data: users, jobs (with source distribution), application pipeline (draft/ready/sending/sent), scrapers, cron status, locks, quotas, errors, **recently active users (last 24h with online status)**. | `src/app/api/admin/stats/route.ts` |
| **Feedback API** | GET: list feedback with status/type filters. PATCH: update status and admin notes. | `src/app/api/admin/feedback/route.ts` |

### Triggerable Actions from Admin

```
SCRAPERS (8):
  indeed, remotive, arbeitnow, linkedin, rozee, jsearch, adzuna, google
  "all" → triggers all 8 sequentially
  "scrape-global" → triggers aggregated scrape mode (with dynamic chaining budget)

CRON JOBS (10):
  instant-apply, match-jobs, match-all-users
  send-scheduled → /api/cron/send-scheduled (sends applications past scheduledSendAt)
  send-queued → /api/cron/send-queued (sends applications in READY status)
  notify-matches, cleanup-stale
  follow-up, check-follow-ups, scrape-global

ADMIN ACTIONS (not crons):
  backfill-emails → POST /api/admin/backfill-emails (extracts emails from descriptions, fixes legacy confidence)

All crons use:
  - verifyCronSecret() with timing-safe comparison (logs to SystemLog on missing CRON_SECRET)
  - acquireLock() with try/catch (returns false on DB error)
  - finally block for lock release (no double-release)
  - cron-tracker.ts for outcome logging (success/error/skipped → SystemLog)
```

---

## 19. MATCHING & SCORING ENGINE

| Feature | Description | Where Used |
|---------|-------------|------------|
| **Hard Filters (8)** | Platform, Company Blacklist, Negative Keywords, Keyword Match, Category, Country, City, Salary. All must pass for a job to be scored. | `src/lib/matching/score-engine.ts` |
| **Negative Keywords** | User-defined terms to exclude jobs. Any match against title/description/skills → score 0. Prevents noise (e.g., "wordpress" for a React developer). Field: `UserSettings.negativeKeywords[]`. | `score-engine.ts` (hard filter), `recommendation-engine.ts` (query-time filter) |
| **Salary Filter** | Parses salary strings ("$80K/yr", "80000-100000") → monthly range. If job's max salary < user's minimum → rejected. Jobs with no salary data always pass. | `score-engine.ts` → `parseSalaryRange()` |
| **Experience Mismatch Penalty** | +5 points for match, -15 for strong mismatch. Uses word-boundary regex for short keywords ("mid", "lead") to avoid false positives ("midnight", "misleading"). Stops juniors seeing "10+ years" roles and seniors seeing intern postings. | `score-engine.ts` Factor 6 |
| **Email Warmup** | Progressive sending limits for new SMTP accounts. Day 1-3: 3/day 2/hour. Day 4-7: 8/day 4/hour. Day 8+: user config. Tracked via `smtpSetupDate` auto-set on first SMTP config. | `src/lib/send-limiter.ts` → `getWarmupLimits()` |
| **Keyword Effectiveness** | Analytics showing per-keyword performance: matches, saves, dismissals, applications. Helps users optimize their keyword list. | `src/app/actions/analytics.ts`, `src/components/analytics/KeywordEffectiveness.tsx` |
| **Dual-Path Matching** | Path A: query-time for `/recommended` (load 2000 jobs → filter → score → paginate). Path B: background cron for auto-apply (fresh jobs only, checks `hasDecryptionFailure` on critical fields). Both share `computeMatchScore()`. | `recommendation-engine.ts` (A), `instant-apply/route.ts` (B) |

---

## 20. EMAIL DELIVERABILITY

| Feature | Description | Where Used |
|---------|-------------|------------|
| **Email Confidence Scores** | Numeric score (0–100) per email. **description_text** (extract-email-from-text.ts): base 85, +10 for hiring prefixes (hr@, careers@) → 85–95. **hiring_post** (google-hiring-posts.ts): 90 (high-quality context). **careers_page_scrape** (email-extractor.ts): 82. **pattern_guess_rcpt_verified**: 35 (guessed from domain, MX + RCPT verified — lowered due to higher bounce rate). Auto-send only if >= 80. Stored on `GlobalJob.emailConfidence`. | `src/lib/extract-email-from-text.ts`, `src/lib/email-extractor.ts`, `src/lib/scrapers/google-hiring-posts.ts`, `GlobalJob.emailConfidence` |
| **Bulk Send Quality Gates** | `/api/applications/bulk-send` applies 3 pre-send filters: (1) quality filter — only apps with `emailConfidence >= 80` AND `recipientEmail`, (2) dedup — first app per recipient email only, (3) cap at 3 per request (Vercel 10s timeout). Response includes `skippedNoEmail`, `skippedLowConfidence`, `duplicatesRemoved` counts. | `src/app/api/applications/bulk-send/route.ts` |
| **Email Quality Badges** | Per-card badge showing email reliability: Verified (green, >= 80), Guessed (amber, 50-79), Unverified (red, < 50/null). Pre-send summary shows verified/guessed/no-email breakdown when bulk selecting. **Kanban JobCard:** Green Mail icon when `emailConfidence >= 80`, amber when lower, globe icon (🌐) when no email. | `src/components/applications/ApplicationQueue.tsx`, `src/components/kanban/JobCard.tsx` |
| **Plain Text Emails** | Application emails sent as plain text only (no HTML). **WHY:** Avoids spam triggers from multipart/alternative structure, HTML markup, and image tracking pixels. | `src/lib/send-application.ts` |
| **SMTP Password Encryption** | AES-256-CBC for SMTP passwords in database. **WHY:** Database breach protection — stolen DB doesn't expose plaintext passwords. Key rotation detection — `hasDecryptionFailure()` catches when ENCRYPTION_KEY changed. | `src/lib/encryption.ts`, `src/lib/send-application.ts` |
| **Decryption Failure Detection** | `hasDecryptionFailure()` checks SMTP credentials before building transporter. On failure: marks app FAILED with "re-save settings" message. | `src/lib/send-application.ts`, `src/lib/encryption.ts` |
| **Resume Attachment Guard** | Resume download failure returns app to READY for retry instead of sending without attachment. | `src/lib/send-application.ts` |
| **X-Mailer Suppressed** | Nodemailer's default `X-Mailer` header removed. Prevents automated spam detection. | `src/lib/send-application.ts` |
| **Error Classification** | `classifyError()` categorizes SMTP errors into 5 types: permanent, transient, rate_limit, auth, network. Each type has different retry/failure behavior. **Plain object handling:** `isAddressNotFound()` and `classifyError()` now extract `.message` from plain objects (not just Error instances) before phrase matching — previously `String({message: "..."})` produced `"[object Object]"` and matching failed. | `src/lib/email-errors.ts` |
| **Provider-Aware Limits** | Detects Gmail/Outlook/Brevo from `emailProvider` or `smtpHost`. Enforces provider-specific daily/hourly caps (Gmail 500/day, Outlook 300/day). | `src/lib/send-limiter.ts` → `detectProvider()` |
| **AI Name Enforcement** | Three-layer fix: (1) `sanitizeResumeForPrompt` strips candidate name/contact from resume before AI sees it, (2) system prompt has CRITICAL rule to use profile name only, (3) `enforceProfileName` post-processes output to replace any resume-derived name with the correct profile name. | `src/lib/ai-email-generator.ts` |

---

## 21. USER FEEDBACK SYSTEM

| Feature | Description | Where Used |
|---------|-------------|------------|
| **Feedback Widget** | Floating button on all dashboard pages. Opens modal with type selector (Bug/Suggestion/Compliment/Other) + text area. Auto-captures current page. | `src/components/shared/FeedbackWidget.tsx` |
| **Server Action** | `submitFeedback()` validates with Zod, creates `UserFeedback` record. | `src/app/actions/feedback.ts` |
| **Admin Panel** | `/admin/feedback` page with filter by status/type, expandable cards, admin notes, status management (new → reviewed → resolved). | `src/app/(admin)/admin/feedback/page.tsx` |
| **Admin API** | GET (list with filters) + PATCH (update status/note) for feedback management. | `src/app/api/admin/feedback/route.ts` |

---

## 22. FRONTEND PERFORMANCE

| Optimization | Where Applied |
|-------------|---------------|
| **React.memo** | `JobCard` (kanban), `JobCard` (recommended), `ApplicationCard`, `Charts` — prevents re-render when props unchanged |
| **useCallback** | All event handlers in heavy components — stable references prevent child re-renders |
| **useMemo** | Filter results, sorted sources, visible jobs, selected counts, **emailCounts** (all/verified/none) on recommended page — avoid recalculation on every render |
| **Debounced search** | Recommended page search input — 400ms debounce, fires at 3+ chars or empty |
| **Stable callbacks** | `buildUrl`, `updateFilter`, `handleDismiss`, `toggleSelect`, `refresh` — wrapped in useCallback with proper deps |
| **Code-split SettingsForm** | 2,300-line form loaded via `next/dynamic` with `ssr: false`. Only the active tab content renders (controlled tabs with `forceMount`). |
| **Lazy-loaded heavy components** | `Charts` (recharts), `OnboardingWizard`, `TemplateEditor` — all use `next/dynamic` with loading skeletons. Avoids shipping recharts bundle on non-analytics pages. |
| **Removed force-dynamic** | All 8 dashboard pages had redundant `export const dynamic = "force-dynamic"`. The dashboard layout already forces dynamic rendering via `cookies()` auth check. Removing it lets Next.js optimize the render pipeline. |

---

## 26. PERFORMANCE ARCHITECTURE

### Server-side optimizations

| Optimization | Description | Where Used |
|-------------|-------------|------------|
| **Parallel data fetching** | `Promise.all` for independent queries on every page. Dashboard loads settings + jobs in parallel. Applications page loads applications + counts in parallel. | All page.tsx server components |
| **Settings caching** | `getSettings()` wrapped in React `cache()` (per-request dedup) + `unstable_cache` (5-minute cross-request TTL). Invalidated via `revalidateTag` on save. | `src/app/actions/settings.ts` |
| **Lightweight settings** | `getSettingsLite()` with Prisma `select` — only fetches the ~12 fields needed for page rendering instead of all 50+ fields. Used on dashboard, recommended, and other non-settings pages. | `src/app/actions/settings.ts` |
| **No redundant force-dynamic** | Removed `export const dynamic = "force-dynamic"` from all 8 dashboard pages. Auth check in layout already forces dynamic rendering — the explicit export was redundant overhead. | All `page.tsx` in `src/app/(dashboard)/` |
| **Query select optimization** | Job detail page uses `select` on globalJob (avoids loading unused fields) and activities (only id, type, description, createdAt). | `src/app/(dashboard)/jobs/[id]/page.tsx` |
| **Prisma dev logging** | `PrismaClient({ log: [{ emit: "stdout", level: "query" }] })` in development mode for identifying slow queries. | `src/lib/prisma.ts` |

### Database optimizations

| Optimization | Description |
|-------------|-------------|
| **Connection pooling** | Neon pooler via `pgbouncer=true` in DATABASE_URL. `connection_limit=5` prevents exhausting serverless connection slots. |
| **Region alignment** | Vercel functions run in `iad1` (Washington DC), matching Neon DB in `us-east-1`. Eliminates 60-80ms cross-region latency per query. |
| **Comprehensive indexes** | 27 composite indexes across models. Key: `(isActive, source, createdAt)` on GlobalJob, `(userId, isDismissed, stage)` on UserJob, `(status, scheduledSendAt)` on JobApplication. |

### SMTP optimizations

| Optimization | Description | Where Used |
|-------------|-------------|------------|
| **Transporter caching** | `getTransporterForUser()` caches transporters in a `Map` keyed by `provider:user:host:port` with 10-minute TTL. Avoids DNS + TLS + auth handshake per email. | `src/lib/email.ts` |
| **Connection pooling** | All transporters use `pool: true` with `maxConnections: 3`. Reuses TCP connections across batch sends. | `src/lib/email.ts` |
| **System transporter singleton** | Brevo system transporter created once and reused across notification emails. Not cached when SMTP_USER/SMTP_PASS env vars are missing (re-evaluates on next call). | `src/lib/email.ts` |

---

## 23. USER ACTIVITY TRACKING

| Feature | Description | Where Used |
|---------|-------------|------------|
| **Heartbeat API** | Lightweight POST endpoint that updates `UserSettings.lastVisitedAt` to current time. No response body needed — fire and forget. | `src/app/api/heartbeat/route.ts` |
| **ActivityTracker** | Invisible client component mounted in dashboard layout. Pings `/api/heartbeat` on page load and every 5 minutes while user is active. Tracks activity across all dashboard pages. | `src/components/shared/ActivityTracker.tsx`, `src/app/(dashboard)/layout.tsx` |
| **Online Detection** | User is "online" if `lastVisitedAt` is within the last 5 minutes. Used in admin dashboard and admin users page to show green/gray status dots. | Admin stats API, admin users page |
| **Admin Visibility** | Admin dashboard shows "Recently Active Users" card with avatars, online indicators, mode badges, and relative timestamps. Admin users page shows sortable "Last Active" and "Joined" columns with online indicators. | `src/app/(admin)/admin/page.tsx`, `src/app/(admin)/admin/users/page.tsx` |

---

## 24. CUSTOM THEMED LOADER

| Feature | Description | Where Used |
|---------|-------------|------------|
| **JobPilotLoader** | Branded loading component with Zap icon, gradient background, orbiting dot animation, glow pulse, progress bar, and "JobPilot" text. Supports `full` (60vh center) and `inline` (padded) variants with contextual labels. | `src/components/shared/JobPilotLoader.tsx` |
| **CSS Animations** | 6 custom keyframe animations: `loader-breathe` (scale pulse), `loader-bolt` (icon pulse), `loader-glow` (opacity pulse), `loader-orbit` (360° rotation), `loader-slide` (progress bar), `loader-fade` (label fade). | `src/app/globals.css` |
| **Usage** | Replaces all 15 `loading.tsx` files across dashboard and admin panels. Each provides a contextual label (e.g. "Finding your matches…", "Loading analytics…"). | All `loading.tsx` files in `src/app/(dashboard)/` and `src/app/(admin)/` |

---

## 25. SETTINGS SUGGESTION TIPS

| Feature | Description | Where Used |
|---------|-------------|------------|
| **SuggestionTip Component** | Amber-styled inline tip box with Lightbulb icon. Appears contextually when fields are empty or suboptimal. Auto-hides when the field is properly configured. | `src/components/settings/SettingsForm.tsx` |
| **Profile Tab Tips** | Completeness banner (missing name/LinkedIn/GitHub). Full name capitalization suggestion when all-lowercase. | Profile tab |
| **Jobs Tab Tips** | Experience level suggestion (Entry → Mid if experienced). Category count warnings (0 selected or 5+ selected). | Job Preferences tab |
| **AI Tab Tips** | Quick-start guide banner (4-step checklist). Custom system prompt example when empty. Tone suggestion for startup roles. Custom closing suggestion when empty. | AI tab |
| **Automation Tab Tips** | Default signature suggestion when empty (uses user's name dynamically). | Automation tab |

---

## WHAT WE EXPLICITLY DON'T USE (and why)

| Technology | Why NOT | What We Use Instead |
|-----------|---------|-------------------|
| **Redux** | Massive boilerplate for simple state. Actions, reducers, selectors, middleware — overkill for our use case. | Zustand (10x simpler, same capability) |
| **MongoDB** | Bad for relational data. Can't JOIN GlobalJob→UserJob→Application efficiently. No foreign keys. | PostgreSQL (relational, JOINs, constraints) |
| **Mongoose** | Only works with MongoDB (which we don't use) | Prisma (works with PostgreSQL) |
| **Express.js** | Next.js has API routes built-in. Adding Express means running two servers. | Next.js API Routes + Server Actions |
| **AWS S3** | Complex setup: IAM roles, bucket policies, signed URLs, CORS config. Overkill for resume PDFs. | @vercel/blob (one line: `put(path, buffer)`) |
| **OpenAI API** | $0.002 per request × 600 requests/day = $36/month. Not free. | Groq (14,400 req/day free, faster response) |
| **Docker** | Not needed for Vercel deployment. Vercel builds from source automatically. | Vercel auto-build from GitHub |
| **Redis** | No real-time features. Rate limiting uses simple in-memory Map. No queue system needed. | In-memory rate limiting in middleware |
| **Socket.io / WebSockets** | No real-time collaboration. Kanban is single-user. Data refreshes on page load. | Standard HTTP requests + server actions |
| **Clerk / Auth0** | Paid after free tier. Clerk: $25/month after 10K MAU. Auth0: complex pricing. | NextAuth.js v4 (100% free, self-hosted) |
| **Tailwind UI** | Paid ($299). Premium Tailwind components. | shadcn/ui (free, same quality, you own the code) |
| **Vercel Cron** | 1 job limit on Hobby. 10-second timeout. Locked in vercel.json. | cron-job.org (unlimited, free, any frequency) |
| **n8n** | Needs VPS ($5/month) or n8n Cloud ($20/month). Visual workflows add complexity. | cron-job.org + Next.js API routes (simpler, free) |
| **Puppeteer / Playwright** | Headless browser scraping — heavy, slow, 300MB+ dependency. Most sources have APIs or RSS. | fetch() + HTML parsing for sources that need scraping |
| **SendGrid** | 300/day free but aggressive spam filtering. Aggressive about domain verification. | Brevo (simpler setup) + user's own SMTP |
| **DOCX parsing** | Added complexity for minimal benefit. 95%+ of resumes are PDF. | PDF-only uploads with paste-text fallback |
| **groq-sdk** | npm package adds bundle weight. Direct fetch to OpenAI-compatible endpoint is lighter and gives us full control over retries/timeouts. | Direct `fetch()` wrapper in `src/lib/groq.ts` |

---

## COST SUMMARY

| Category | Technology | Monthly Cost |
|----------|-----------|-------------|
| Hosting | Vercel Hobby | $0 |
| Database | Neon PostgreSQL | $0 |
| File Storage | Vercel Blob | $0 |
| AI | Groq | $0 |
| Notifications | Brevo SMTP | $0 |
| Applications | User's Gmail/Outlook SMTP | $0 |
| Scheduling | cron-job.org | $0 |
| Job APIs (paid) | RapidAPI + Adzuna + SerpAPI | $0 |
| Auth providers | Google + GitHub OAuth | $0 |
| DNS check | Google Public DNS | $0 |
| **TOTAL** | | **$0/month** |

First paid upgrade needed at ~50+ users: Vercel Pro ($20/month) for more bandwidth + longer function timeouts.

---

## 27. OPTIMISTIC UI STATE MANAGEMENT

| Aspect | Details | Files |
|--------|---------|-------|
| **Pattern** | Client-side `localStatuses` Map overlays server state. `effectiveStatus = localStatus ?? serverStatus`. Immediate visual feedback on mutations without waiting for server refresh. | `ApplicationQueue.tsx` |
| **Double-send prevention** | Three-layer defense: (1) UI hides Send button when `effectiveStatus !== DRAFT/READY`, (2) API returns 400 if `status === SENT`, (3) `sendApplication()` uses atomic `updateMany WHERE status IN [DRAFT, READY]` — second caller gets `count: 0` and exits. | `ApplicationQueue.tsx`, `send/route.ts`, `send-application.ts` |
| **Bulk operations** | Each item in a bulk send updates optimistically as it's processed. Already-sent items are filtered from `selectedSendable` using `getEffectiveStatus()`. Tab badge counts recompute from `effectiveCounts` (not server counts). | `ApplicationQueue.tsx` |
| **Sidebar live status** | Fetches `/api/settings/mode` on mount to reflect actual `accountStatus` (active/paused). Dynamic badge: green "Auto-Search Active" or amber "Auto-Apply Paused". | `Sidebar.tsx` |

---

## 28. STATE REFRESH STRATEGY BY PAGE

| Page | Data Source | Refresh Mechanism | Real-time? |
|------|-----------|-------------------|------------|
| Dashboard (Kanban) | Server props + Zustand | `router.refresh()` + optimistic drag | Yes (optimistic) |
| Dashboard (TodaysQueue) | Server props | Page re-render on navigation | No (server-only) |
| Recommended | Server props + `useTransition` | URL search params drive server re-fetch | Yes (filter-driven) |
| Applications | Server props + `localStatuses` | Optimistic state overlays server data | Yes (optimistic) |
| SendingStatusBar | SWR (`/api/applications/send-stats`) | 10s polling + `fallbackData` from server | Yes (SWR polling) |
| Settings | Server props | Form state updates locally, `router.refresh()` on save | Partial |
| Analytics | Server props | Page re-render on navigation | No (server-only) |
| System Health | Client fetch + `useEffect` | Manual refresh button + initial load | Partial |
| Admin Dashboard | SWR | 30s polling + manual refresh | Yes (SWR polling) |

---

## 29. AUTO-APPLY READINESS CHECKLIST

| Feature | Description | Where Used |
|---------|-------------|------------|
| **Purpose** | Shows 5 checks at top of Automation tab: Application Mode, Auto Apply enabled, Resume uploaded, Keywords configured, Email configured. Helps users verify readiness for auto-apply before enabling. | `src/components/settings/SettingsForm.tsx` |
| **Visibility** | Hidden when `applicationMode === MANUAL`. Shown for SEMI_AUTO, FULL_AUTO, INSTANT. | Automation tab |
| **States** | Green border when all 5 checks pass. Amber border when any fail. Uses existing props — no new API calls. | SettingsForm |
