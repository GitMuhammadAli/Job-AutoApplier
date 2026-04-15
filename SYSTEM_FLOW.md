# JOBPILOT — How Everything Works (Complete Technical Deep Dive)

This document explains every system in the project, how they connect,
why they exist, and what happens at each step. Read this to fully
understand the engine.

---

## PRODUCTION REALITY CHECK (Live Data Snapshot)

```
These numbers reflect real production data — use them to calibrate expectations.
Note: These are point-in-time snapshots; actual production numbers may have grown since this snapshot.

TOTAL JOBS:        10,620
LINKEDIN SHARE:    8,857 (83%) — dominates volume
JOBS WITH EMAIL:   103 (1.0%) — most jobs have no verified email

LINKEDIN DESCRIPTIONS: 0% — 8,856 of 8,857 jobs have null description
  WHY we still run LinkedIn: titles, companies, and URLs still match user keywords
  and provide "Apply on Site" links. Volume justifies inclusion despite no descriptions.

BEST EMAIL RATES BY SOURCE:
  Indeed:  18.8%
  Rozee:   14.7%
  JSearch: 9.6%

DELIVERY STATS:
  19 sent, 0 bounced → 100% delivery rate (user's own SMTP = inbox, not spam)

BACKFILL EXTRACTION:
  One-time admin backfill-emails endpoint extracted 30 new emails from descriptions
  of jobs that previously had none — proves the extraction pipeline works.
```

---

## THE BIG PICTURE — What Happens Every 30 Minutes

```
The system runs on 10 crons, optimized for quota and speed:

  EVERY 2 HOURS    → Free scrapers fire (LinkedIn, Remotive, Arbeitnow, LinkedIn Posts)
  DAILY 6 AM       → Paid scrapers fire (JSearch, Indeed, Adzuna, Google Jobs, Rozee)
  EVERY HOUR       → Matcher scores new jobs against each user's preferences
  EVERY 30 MIN     → Instant-apply creates drafts for matched jobs with emails
  EVERY 5 MIN      → Send-queued and send-scheduled deliver approved emails
  DAILY 9-11 AM    → Notifications, follow-ups, follow-up checks
  DAILY 3 AM       → Cleanup stale jobs

  After each scrape → instant-apply fires automatically (fire-and-forget)
  After matching → notify-matches fires if new matches found

  Everything is automated except the user's decision to apply.
```

Let's break down EVERY piece.

---

## PART 1: HOW SCRAPING WORKS

### What is scraping?

Scraping = programmatically visiting job websites and extracting job listings.
Instead of a human browsing Indeed.com, our code does it and saves the results to our database.

### The 9 Sources

```
FREE SOURCES (no API quota, run every 2 hours via mode=free):
  1. Remotive        → REST API (remotive.com/api/remote-jobs)
  2. Arbeitnow       → REST API (arbeitnow.com/api/job-board-api)
  3. LinkedIn Jobs    → Via RSS feed (free)
  4. LinkedIn Posts   → Google CSE for hiring posts on LinkedIn
                        (catches 30-40% of informal job postings in Pakistan)

PAID SOURCES (limited quota, run once daily at 6 AM via mode=paid):
  5. JSearch          → RapidAPI ($0 for 200 calls/month)
  6. Indeed           → Via RapidAPI (same JSearch quota)
  7. Adzuna           → Their API ($0 for 200 calls/day)
  8. Google Jobs      → Via SerpAPI ($0 for 100 calls/month)
  9. Rozee.pk         → Via SerpAPI (shares Google Jobs quota)

WHY FREE/PAID SPLIT:
  Running paid scrapers every 2 hours = 12 runs/day × ~12 API calls = 144/day
  JSearch: 200/month would be exhausted in 2 days
  SerpAPI: 100/month would be exhausted in 1 day
  Solution: Free scrapers every 2h, paid scrapers once daily at 6 AM
  Two cron-job.org entries:
    ?mode=free&match=true  → every 2 hours (0 */2 * * *)
    ?mode=paid&match=false → daily at 6 AM (0 6 * * *)

MANUAL:
  10. Quick Add from URL → Paste any URL, auto-extract job details
  11. PWA Share Target   → Share from LinkedIn/Chrome app directly to JobPilot
```

### How a single scraper works (example: Remotive)

```
File: /api/cron/scrape/[source]/route.ts

Step 1: AUTHENTICATION
  → Request comes in with ?secret=YOUR_CRON_SECRET (or Bearer header)
  → verifyCronSecret() checks timing-safe comparison
  → If CRON_SECRET env var is missing → log to SystemLog + return 401
  → If secret doesn't match → return 401 Unauthorized
  → If yes → proceed

Step 2: GET KEYWORDS
  → Call aggregateSearchQueries()
  → This queries ALL active users' keywords from UserSettings
  → User A keywords: ["React", "Node.js"]
  → User B keywords: ["Python", "Django"]
  → User C keywords: ["React", "TypeScript"]
  → Combined + deduplicated: ["React", "Node.js", "Python", "Django", "TypeScript"]
  → These become our search terms

Step 3: FETCH FROM API
  → For each keyword (or combined):
    fetch("https://remotive.com/api/remote-jobs?search=React&limit=50")
  → Response: JSON array of job objects
  → Each job has: title, company, description, url, salary, tags, date

Step 4: TRANSFORM DATA
  → Map API response to our GlobalJob schema:
    {
      sourceId: "remotive-12345",     ← unique ID from source
      source: "remotive",             ← which platform
      title: "Senior React Developer",
      company: "TechCorp",
      location: "Remote",
      description: "We are looking for...",
      url: "https://remotive.com/job/12345",
      salary: "$120k - $160k",
      skills: ["React", "TypeScript", "Node.js"],
      category: "Frontend",
      isActive: true,
      isFresh: true,                  ← NEW — hasn't been matched yet
      lastSeenAt: new Date(),
    }

Step 5: DEDUPLICATION
  → Before saving, check: does a GlobalJob with this sourceId + source already exist?
  → Schema has @@unique([sourceId, source])
  → If exists → UPDATE (refresh lastSeenAt, update any changed fields)
  → If new → CREATE
  → This prevents the same job appearing twice

Step 6: AUTO-CATEGORIZATION
  → categorizeJob(title, description) runs on every job
  → Scans title + description for keywords:
    "React" in title → category: "Frontend"
    "Node.js" + "Express" → category: "Backend"
    "Full Stack" in title → category: "Full Stack"
    "Kubernetes" + "Docker" → category: "DevOps"
  → Returns null on failure (no longer defaults to "Software Engineering")
  → This matters because users select categories in settings

Step 7: SKILL EXTRACTION
  → extractSkills(description) runs on every job
  → Regex + keyword matching against a skills database:
    "experience with React and TypeScript" → skills: ["React", "TypeScript"]
    "PostgreSQL, MongoDB, Redis" → skills: ["PostgreSQL", "MongoDB", "Redis"]
  → Stored as JSON array on GlobalJob.skills

Step 8: LOGGING
  → Log to SystemLog table:
    type: "scrape-detail" (enhanced from "scrape") — includes emails found count and queries used in metadata
    { type: "scrape-detail", source: "remotive", message: "Scraped 25 jobs, 18 new, 7 updated", metadata: { emailsFound, queriesUsed } }
  → scraper-runner.ts: on error, logs error type, partial results, duration

Step 9: RETURN RESPONSE
  → Return JSON: { source: "remotive", scraped: 25, new: 18, updated: 7, duration: "2.3s" }
```

### What "isFresh" means

```
When a job is first scraped → isFresh = true
After the matcher processes it → isFresh = false

This is crucial:
  - The matcher ONLY looks at fresh jobs (not all 10,000 jobs every time)
  - After matching, the job is marked as processed
  - Next scrape cycle: only NEW jobs are fresh
  - This is why the system is fast even with thousands of jobs

WHY isFresh exists:
  Without it, we'd re-process 10,000+ jobs every 30 minutes against every user.
  That would be O(users × jobs) every cycle — unsustainable. isFresh limits
  matching to only NEW jobs since last cycle, making the matcher O(users × fresh_count).
```

### What "aggregateSearchQueries" does

```typescript
// This is the KEY to the global scrape architecture

async function aggregateSearchQueries() {
  // Get ALL active, onboarded users' keywords
  const users = await prisma.userSettings.findMany({
    where: { accountStatus: "active", isOnboarded: true },
    select: { keywords: true },
  });

  // Merge into one deduplicated set
  const allKeywords = new Set<string>();
  for (const user of users) {
    for (const keyword of user.keywords || []) {
      allKeywords.add(keyword.toLowerCase());
    }
  }

  return Array.from(allKeywords);
}

// WHY GLOBAL SCRAPING (one shared GlobalJob table, not per-user):
// API calls = f(unique_keywords), NOT f(users). 20 users with overlapping
// keywords → maybe 30 unique keywords. We search ONCE with 30 keywords,
// not 20 times. Same cost for 1 user or 20. This is why adding users
// barely increases API costs — the scrape is shared infrastructure.
//
// Paid mode: ROI-weighted selection — keywords that led to sent applications
// get 3x weight when building the query list.
```

### Block detection (LinkedIn, Indeed)

```
Some sites detect bots and block requests.

Protection measures:
  1. User-Agent rotation — pretend to be different browsers
  2. Rate limiting — 2-5 second delay between requests to same source
  3. Request headers — Accept, Accept-Language headers to look like a real browser

Paid scrapers (JSearch, Indeed, Google Jobs, Rozee) have 150-200ms sleeps between API calls to prevent burst requests.
  4. If blocked (403/429) → log error, skip this source, try next cycle
     Other sources continue working normally
```

### Scraper parallelization

```
The scrape-global cron runs all scrapers in parallel instead of sequentially.

How it works:
  → Map each source to a scraper task (async function)
  → Promise.allSettled(scraperTasks) — all run concurrently
  → Each scraper has its own timeout handling (default 8s)
  → Failed scrapers don't block others — results collected per source
  → Eliminates the sequential timeout bottleneck
  → Fallback scraper skipped if <1s remains (prevents Vercel hard-kill)

WHY Promise.allSettled (not Promise.all):
  One failed scraper (e.g., Indeed blocked, Rozee CAPTCHA) would kill the
  entire run with Promise.all. allSettled collects results per source —
  LinkedIn can succeed while Indeed fails. Other sources continue working.

WHY 8s default timeout:
  Vercel Hobby plan kills serverless functions at 10s. We need a 2s safety
  margin for cleanup, logging, and response. 8s lets scrapers bail gracefully
  before the hard kill.

File: src/app/api/cron/scrape-global/route.ts
```

### Scraper volume boost

```
All scrapers have been boosted for higher job volume:

  - More queries per source (e.g., JSearch: 8 queries instead of 6)
  - More pages per query where supported (num_pages, limit increases)
  - Higher per-source limits (Remotive: 200 jobs, etc.)

Schedule change:
  - Google Jobs and Rozee now run daily instead of alternating days
  - Both are included in getPaidSourcesToday() and the default scrape-global mode

File: src/lib/scrapers/source-rotation.ts
File: src/app/api/cron/scrape-global/route.ts (SCRAPERS config)
```

### New email extraction pipeline (during scraping)

```
extractEmailFromText() runs on every job description during scraping.

WHERE IT RUNS:
  1. scrapeAndUpsert (per-source) — in scrape-source.ts, when transforming
     each scraped job before upsert. New jobs get email from description.
  2. scrape-global — when enriching existing jobs during re-scrape.
     Jobs that already exist get email backfilled from description if they
     had none, and longer descriptions can replace shorter ones.

HOW IT WORKS:
  → Regex finds all emails in description text
  → Filters: exclude gmail/yahoo/linkedin, noreply, generic prefixes
  → Prefer hiring prefixes (hr@, careers@, jobs@) → +10 confidence
  → Penalize personal patterns (first.last@) → -10 confidence
  → Returns { email, confidence } — confidence 85–95 for description_text

EXISTING JOBS ENRICHED:
  During re-scrape, if job exists but has no companyEmail and description
  has an email → extract and save. Backfill + longer description update.

Files:
  src/lib/extract-email-from-text.ts
  src/lib/scrapers/scrape-source.ts (per-source)
  src/app/api/cron/scrape-global/route.ts (global enrich)
```

### Persistent company email cache

When scraping finds emails, they're persisted to a CompanyEmail table.
This cache survives redeployments — once an email is found, it's reused forever.

How it works:
  → After each scrape run, backfillCompanyEmails() runs
  → Step 1: High-confidence emails from GlobalJob are upserted to CompanyEmail table
  → Step 2: Jobs without emails are checked against the CompanyEmail cache
  → Step 3: Matching companies get their email backfilled (confidence capped at 75, source: "company_db")
  → Result: One email find can cover dozens of jobs from the same company

File: src/lib/scrapers/post-scrape-enrichment.ts
Table: CompanyEmail (companyNorm unique, email, confidence, source, lastVerifiedAt)

### Fixed LinkedIn Posts scraper

```
BEFORE (keyword×city pairs, narrow):
  Queries like "hiring React Lahore" — too specific, missed remote/global posts.
  3-day date window — Google indexes slowly, posts appeared after window closed.
  Quoted hiring terms — over-restrictive.

AFTER (keyword-only first, then city):
  Strategy 1 — keyword-only: "site:linkedin.com/posts hiring React"
    → Global reach, catches remote and informal posts
  Strategy 2 — keyword+city: "site:linkedin.com/posts hiring React Lahore"
    → City-specific as second strategy for local hiring

  Date window: 7 days (dateRestrict=d7, qdr:w1) — broader capture
  Broader search terms — removed quoting around hiring terms
  HIRING_TERMS: hiring, we are hiring, looking for, join our team, job opening, open position, apply now

File: src/lib/scrapers/google-hiring-posts.ts
```

---

## PART 2: HOW MATCHING WORKS

### Two matching paths (same scoring function)

```
WHY two paths (query-time vs cron):
  Recommended page needs instant results for browsing — user opens /recommended
  and sees jobs immediately. Auto-apply needs background processing — cron runs
  match + draft/send without user present. Same scoring, different triggers.

The system uses TWO paths for matching, both sharing computeMatchScore():

PATH A — QUERY-TIME (for display on /recommended page):
  User opens page → getRecommendedJobs(userId, filters)
    → SQL: load up to 2000 active GlobalJobs (last 30 days)
    → JS: HARD FILTER — location (city/country/remote)
    → JS: HARD FILTER — negative keywords (reject matching jobs)
    → JS: HARD FILTER — keywords (at least 1 must match)
    → JS: score remaining jobs (computeMatchScore)
    → JS: deduplicate cross-source
    → Sort, paginate, return
  Descriptions loaded for scoring but stripped before sending to client.
  URL search params drive server-side filtering (source, sort, minScore, location, jobType, search).
  **3-way email filter:** "all" | "verified" | "none" — server-side filtering by emailConfidence; chips show live counts (e.g., "All (247)", "Can Email (43)", "No Email (204)").

PATH B — BACKGROUND CRON (for auto-apply):
  Cron fires → for each auto-apply user × each fresh job:
    → Run SAME computeMatchScore()
    → SAME hard filters
    → If score ≥ minMatchScoreForAutoApply → create UserJob + Application
  Uses isFresh tracking to avoid reprocessing.

File: src/lib/matching/recommendation-engine.ts  (Path A)
File: src/lib/matching/score-engine.ts           (shared scoring, used by both)
File: src/app/api/cron/instant-apply/route.ts    (Path B)
```

### The matching engine is the BRAIN of JobPilot

```
INPUT:  One GlobalJob + One User's Settings + User's Resume (with detectedSkills)
OUTPUT: { score: 0-100, reasons: [...], pass: true/false }

It answers: "How relevant is THIS job for THIS user?"
```

### The 8 Hard Filters (gates — must pass ALL)

```
WHY hard filters before scoring:
  Eliminate obviously irrelevant jobs before spending CPU on computeMatchScore.
  A job with zero keyword match gets score=0 anyway — no need to run the
  full 7-factor scoring. Hard filters are cheap; scoring is heavier.
  Order: platform → blacklist → negative keywords → keyword match → category → location → salary.

HARD FILTER 1: PLATFORM
  User enabled platforms: ["indeed", "remotive", "arbeitnow"]
  Job source: "remotive"
  Check: Is source in user's enabled platforms?
  "remotive" is in list → YES ✅ → passes filter

HARD FILTER 2: COMPANY BLACKLIST
  User blacklisted companies: ["current employer inc"]
  Job company: "TechCorp"
  Check: Is company name in the blacklist? (fuzzy: both sides lowercased, substring match)
  "techcorp" NOT in blacklist → PASSES ✅
  If job was from "Current Employer Inc" → score = 0, REJECTED immediately

HARD FILTER 3: NEGATIVE KEYWORDS ← NEW
  User negative keywords: ["wordpress", "php", "internship"]
  Job text: "Senior React Developer with TypeScript experience..."
  Check: Does ANY negative keyword appear in title, description, or skills?
  "wordpress" → NO, "php" → NO, "internship" → NO → PASSES ✅
  If ANY negative keyword matches → score = 0, REJECTED immediately.

  Use case: A React developer doesn't want WordPress roles that mention React.
  Field: UserSettings.negativeKeywords[] (configured in Settings → Job Preferences)

HARD FILTER 4: KEYWORD MATCH
  User keywords: ["React", "Node.js", "TypeScript"]
  Job text: "Senior React Developer with TypeScript experience..."
  Check: Does ANY keyword appear in title or description?
  "React" → YES ✅ → passes filter

  If ZERO keywords match → score = 0, pass = false → job NEVER shown

HARD FILTER 5: CATEGORY MATCH
  User categories: ["Frontend", "Backend", "Full Stack"]
  Job category: "Frontend"
  Check: Is job category in user's selected categories?
  "Frontend" is in user's list → YES ✅ → passes filter

HARD FILTER 6: COUNTRY MATCH
  User country: "pakistan"
  Job location: "Lahore, Pakistan"
  Check: For non-remote jobs, does the location include the user's country?
  "pakistan" found → YES ✅ → passes filter
  Remote jobs always pass this filter

HARD FILTER 7: CITY MATCH
  User city: "lahore"
  Job location: "Lahore, Pakistan"
  Check: For non-remote, on-site jobs, is the job in the user's city?
  "lahore" found → YES ✅ → passes filter

HARD FILTER 8: SALARY
  User minimum salary: 80000 (monthly)
  Job salary: "$30K/year"
  Check: Parse salary → convert to monthly → if max < user min, reject.
  $30K/year = $2,500/month < $80,000 → REJECTED ❌
  If job has no salary data → PASSES (most jobs don't list salary)
```

### The 7 Scoring Factors (only if passed all hard filters)

```
Factor 1: KEYWORD MATCH (0-30 points) — Most important
  User keywords: ["React", "Node.js", "TypeScript", "Next.js", "Full Stack"]
  Job text contains: "React", "TypeScript", "Next.js" → 3 out of 5
  Score: (3/5) × 30 = 18 points

Factor 2: TITLE RELEVANCE (0-20 points, or 0-25 if no description)
  Keywords in the TITLE are worth more (title = what the job IS)
  Title: "Senior React Developer"
  "React" is in title → 10 points
  "TypeScript" is NOT in title → 0
  If job has no description, title weight increases to 25 max

Factor 3: SKILL MATCH (0-20 points)
  TWO-LAYER matching:
  Layer A — Structured (primary): Resume detectedSkills vs job skills
    Resume detectedSkills: ["React", "Node.js", "TypeScript", "PostgreSQL", "Docker"]
    Job required skills: ["React", "TypeScript", "Next.js", "PostgreSQL"]
    Matched: React, TypeScript, PostgreSQL → 3 out of 4
    Score: (3/4) × 20 = 15 points

  Layer B — Raw text fallback: If detectedSkills is empty, fall back to
    matching job skill keywords against resume.content raw text.
    Less accurate but catches skills missed by the extractor.

Factor 4: CATEGORY MATCH (0-10 points)
  User categories include "Frontend", job is "Frontend" → 10 points

Factor 5: LOCATION MATCH (0-10 points, can be -15 penalty)
  Remote job + user has workType preference → 7 points (remote match)
  Remote job + user has empty workType → 0 points (neutral, no penalty)
  Exact city match → 10 points
  Same country → 5 points
  Wrong country, not remote → -15 penalty
  User wants remote + job is on-site elsewhere → penalty
  Country matching checks ALL parts of location (not just last part)

Factor 6: EXPERIENCE LEVEL (+5 match, -15 mismatch)
  User level: "mid"
  Job title has "Mid-level" → matches → +5 points
  Job title has "Senior/Lead/Principal" → strong mismatch → -15 penalty
  Job title has "Intern/Graduate" → mismatch for mid → -15 penalty

  Uses word-boundary matching for short keywords ("mid", "lead") to
  avoid false positives ("midnight", "misleading" won't trigger).

  This prevents juniors from seeing "10+ years required" jobs and
  seniors from seeing intern positions.

  WHY -15 penalty: Strong enough to drop a job below the 40% display
  threshold. A 50-point job with experience mismatch becomes 35 → hidden.
  Softer penalties (e.g. -5) wouldn't filter effectively.

Factor 7: FRESHNESS BONUS (0-5 points)
  < 24 hours old → 5 points
  1-3 days → 3 points
  3-7 days → 1 point
  > 7 days → 0 points

TOTAL: 18 + 10 + 15 + 10 + 7 + 5 + 0 = 65 points
```

### Score thresholds

```
SHOW_ON_KANBAN:  40 minimum → job appears on user's board
NOTIFY:          50 → included in email notification digest
AUTO_DRAFT:      55 → AI auto-generates email draft (Semi-Auto mode)
AUTO_SEND:       65 → auto-sent after delay (Full-Auto mode)
```

### Example: Why "Copywriter" gets filtered

```
User keywords: ["React", "Node.js", "TypeScript"]
Job: "Copywriter — Content Marketing"
Job description: "Write blog posts, SEO, WordPress..."

HARD FILTER 3: Keyword match?
  "React" in "Copywriter Write blog posts SEO WordPress" → NO
  "Node.js" → NO
  "TypeScript" → NO
  0 out of 3 match → FAIL ❌

  Score = 0, pass = false
  → This job NEVER appears on the user's Kanban
```

### When matching runs

```
Matching runs in TWO scenarios:

1. AUTOMATIC (via match-all-users / instant-apply cron):
   → Cron fires
   → Query all GlobalJobs where isFresh = true AND userJobs: { none: {} }
   → Only genuinely unmatched jobs are processed (no 3-day window)
   → Keeps workload constant as the DB grows
   → For EACH active user:
     → For EACH fresh job:
       → Run computeMatchScore(job, userSettings, resume)
       → If pass → create UserJob (appears on their Kanban)
       → If fail → skip (job is irrelevant for this user)
   → After processing, mark all fresh jobs as isFresh = false

2. MANUAL (user clicks "Scan Now"):
   → Same logic but triggered on-demand
   → Only matches against jobs that haven't been matched to THIS user yet
   → Rate limited: 1 scan per 5 minutes
```

---

## PART 3: HOW AI EMAIL GENERATION WORKS

### When does AI run?

```
AI runs when:
  1. User clicks a job → QuickApplyPanel opens → on-demand email generation
  2. Semi-Auto/Full-Auto: cron creates draft/ready applications → AI generates per job
  3. User clicks "AI Rephrase" on a resume → on-demand resume rewriting

It's on-demand = one Groq API call per action.
This is why Groq's 14,400/day limit is plenty.
```

### The email generation flow

```
USER ACTION:
  User clicks "Senior React Developer at TechCorp" on Kanban
  → Job detail page opens
  → QuickApplyPanel component mounts
  → Calls: generateApplicationEmail(userJobId) server action

SERVER ACTION (what happens on the server):

Step 1: GATHER CONTEXT
  → Fetch the GlobalJob (title, company, description, skills, source)
  → Fetch UserSettings (name, phone, tone, language, custom prompt, signature, social links)
  → Pick best Resume via 4-tier matching (category → skill overlap → AI tiebreaker → default)
  → Fetch default EmailTemplate (subject pattern, body pattern)

Step 2: BUILD THE AI PROMPT
  System prompt enforces:
  - 100-150 word limit (readable in under 2 minutes)
    WHY: HR reads hundreds of emails. Shorter = actually read. Long emails get skimmed or skipped.
  - No clichés ("I am writing to express my interest" banned)
  - No placeholder brackets ([Company], {{name}} banned)
  - Use actual company name and job title
  - Mention 2-3 specific skills from resume that match the job
  - Say "Please find my resume attached" but do NOT put any URLs/links/phone in body
  - End with candidate's custom closing or name
  - Reference the source platform naturally if provided

  User prompt includes:
  - Full job details (title, company, description, skills, location, salary)
  - Candidate info (name, key skills from detectedSkills, experience level)
  - Resume content (first 3000 chars)
  - Template style guidance (if template exists)

Step 3: CALL GROQ API
  → POST https://api.groq.com/openai/v1/chat/completions (direct fetch, no SDK)
  → Model: llama-3.1-8b-instant
  → Temperature: 0.7
  → Max tokens: 800
  → Retry: up to 2 retries with backoff on 429/5xx

Step 4: BULLETPROOF JSON EXTRACTION
  The AI sometimes returns malformed JSON, markdown-wrapped JSON, nested JSON,
  or plain text. The system handles ALL cases:

  → extractSubjectAndBody(rawResponse):
    → Try JSON.parse directly
    → Try extracting from markdown ```json blocks
    → Try deepUnwrapJson for nested escaped JSON
    → Try regex extraction of "subject" and "body" fields
    → Final fallback: use raw text as body, generate subject from job title

  → unescapeJsonString handles \\n, \\", \\/ etc.
  → This ensures raw JSON like {"subject":"...", "body":"..."} NEVER appears
    as the email body — which was a critical bug that was fixed.

Step 5: STRIP INLINE LINKS FROM BODY
  The AI sometimes ignores the "no URLs in body" instruction.
  Post-generation cleanup:
  → Strip LinkedIn URL if AI put it inline
  → Strip GitHub URL if AI put it inline
  → Strip Portfolio URL if AI put it inline
  → Strip phone number if AI put it inline
  → Clean up orphaned "visit my LinkedIn profile ()" text

Step 5.5: ENFORCE PROFILE NAME
  The AI sometimes pulls the candidate's name from the resume content
  instead of using the profile name from settings.

  WHY 3-layer name enforcement: AI kept pulling wrong name from resume text
  (e.g. "John Smith" from a reference, or a co-author). Single fixes failed.
  Three layers: strip from prompt, prompt rule, post-process replacement.

  Three-layer fix:
  a) sanitizeResumeForPrompt(): strips candidate name and contact info
     from resume text BEFORE sending to AI (prevents AI from seeing it)
  b) System prompt: CRITICAL rule says "use CANDIDATE PROFILE name,
     ignore names in resume content"
  c) enforceProfileName(): post-processes subject + body, replacing any
     resume-derived name with the correct profile fullName

  File: src/lib/ai-email-generator.ts

Step 6: BUILD PROFESSIONAL SIGNATURE BLOCK
  Instead of ugly inline URLs, the system builds a clean contact block:

  → Append defaultSignature (from Settings) if set
  → Then append contact details (only if NOT already in signature):
    Phone: +923367749668
    LinkedIn: https://www.linkedin.com/in/alishahid-fswebdev/
    GitHub: https://github.com/GitMuhammadAli
    Portfolio: https://yoursite.com

  → Deduplication: if signature already contains "linkedin.com/in/" → skip LinkedIn line
  → Phone is included automatically when set in Settings

Step 7: SAVE TO DATABASE
  → Create or update JobApplication:
    {
      status: "DRAFT",
      subject: "Application for Senior React Developer — Ali Shahid",
      emailBody: "Hi TechCorp team,\n\n...\n\nBest regards,\nAli Shahid\n\nPhone: ...",
      resumeId: matched resume ID,
    }

Step 8: RETURN TO UI
  → QuickApplyPanel receives { subject, body }
  → Displays in editable text fields
  → User can edit, regenerate, or send
```

### What HR receives (actual email format)

```
FROM: Ali Shahid <alishahid.dev@gmail.com>
TO: careers@techcorp.com
SUBJECT: Application for Senior React Developer — Ali Shahid

Hi TechCorp team,

I came across this role on LinkedIn while searching for opportunities
that leverage my expertise in Node.js and React.js. With production
experience building end-to-end MERN stack applications at NgXoft Solutions,
I'm confident I can contribute to your engineering team.

My experience with Node.js, Express.js, and MongoDB aligns with your
requirements. I've delivered full-stack applications with 60+ API endpoints,
JWT authentication, and responsive dashboards.

Please find my resume attached. I would appreciate the opportunity to
discuss how I can contribute to TechCorp.

Best regards,
Muhammad Ali
linkedin.com/in/ali

Phone: +923367749668
GitHub: https://github.com/GitMuhammadAli

📎 MERN-Ali-Shahid.pdf (attached)

KEY POINTS:
  ✅ FROM is the user's real Gmail (not "noreply@brevo.com")
  ✅ WHY user's own SMTP: Emails from "ali@gmail.com" have ~100% inbox rate.
    "noreply@brevo.com" hits spam. Real person = trusted; transactional = flagged.
  ✅ No spam warnings (it's a real Gmail account sending)
  ✅ Resume is attached as PDF
  ✅ Contact info is clean and formatted at the bottom
  ✅ No ugly inline URLs in the body paragraph
  ✅ 100-150 words (quick to read)
  ✅ HR has no way to know it was automated
```

### Cover letter generation

```
Same flow but different prompt:
- 200-350 words, more detailed than the email
- Include why this specific company interests you
- 2-3 relevant accomplishments with specifics
- How your skills match their requirements

Returns separately, stored in coverLetter field.
Not sent in the email — available for copying or attaching.
```

### AI Pitch Generation

```
New endpoint: POST /api/jobs/generate-pitch

Purpose: Generate a short pitch (3-4 sentences) and full cover letter for a
specific job, for use in the Quick Apply Kit when applying on external sites.

Input: { userJobId: string }
Uses: job description, user profile (name, experience level), resume skills

Output: { pitch: string, coverLetter: string }
  - pitch: 3-4 sentences answering "Why are you interested?" or "Tell us about yourself"
  - coverLetter: 150-200 words, tailored to the job, no placeholders

AI: Groq API (generateWithGroq), temperature 0.7, max_tokens 1000
JSON extraction: handles markdown-wrapped JSON and regex fallback

File: src/app/api/jobs/generate-pitch/route.ts
```

### Template system

```
Templates are NOT sent directly. They GUIDE the AI.

Template: "Dear {{company}} Hiring Team,
           I'm interested in the {{position}} role...
           {{closing}}"

The AI sees this template as "style guidance":
  → It understands the structure (greeting, body, closing)
  → It writes something SIMILAR but personalized
  → The result is NOT a copy of the template — it's AI-written in that STYLE

Different templates = different email styles:
  "Professional Standard" → formal, structured
  "Casual & Confident"    → friendly, shorter
  "Technical Deep Dive"   → lists specific technical skills
```

---

## PART 4: HOW CRON JOBS WORK

### What is a cron job?

```
A cron job = code that runs automatically on a schedule.
Instead of a human clicking a button every 30 minutes,
the system calls a URL automatically.

We use cron-job.org (free service) to call our API routes on schedule.
cron-job.org is just a clock that hits our URLs — the actual logic
runs on our servers (Vercel).
```

### The cron routes

```
SCRAPING:
  /api/cron/scrape-global       → Scrapes all 8 sources (aggregated keywords)
  /api/cron/scrape/[source]     → Scrapes a specific source

  Note: LinkedIn Posts (linkedin_posts) runs inside scrape-global, not as a separate
  /api/cron/scrape-posts cron. The scrape-posts route exists for manual/admin trigger only.

MATCHING:
  /api/cron/match-all-users     → Matches fresh jobs against all users
  /api/cron/match-jobs          → Matches jobs for a specific user
  /api/cron/instant-apply       → Match + auto-draft/send for Auto modes
                                  (checks hasDecryptionFailure on critical fields)

SENDING:
  /api/cron/send-queued         → Sends applications in READY status (batch of 3)
  /api/cron/send-scheduled      → Sends scheduled applications past their send time (batch of 3)

FOLLOW-UPS:
  /api/cron/follow-up           → Handles follow-up sending
  /api/cron/check-follow-ups    → Finds applications sent 7+ days ago, drafts follow-ups
                                  (followUpCount incremented transactionally with draft)

NOTIFICATIONS:
  /api/cron/notify-matches      → Sends email digests of new matches to users

MAINTENANCE:
  /api/cron/cleanup-stale       → Marks old unseen jobs as inactive
                                  (re-checks userJobs: { none: {} } before delete)
                                  Position-filled detection: after HEAD requests, pages
                                  returning 200 are GET-fetched and checked for phrases
                                  like "position has been filled", "job is closed",
                                  "no longer accepting applications" in the first 10KB

ADMIN (one-time / manual):
  POST /api/admin/backfill-emails → One-time email extraction from descriptions
    Phase 1: Scan jobs with description but no companyEmail → extractEmailFromText
    Phase 2: Set confidence=85 on legacy emails that have companyEmail but no emailConfidence
    Triggerable from Admin → Scrapers → "backfill-emails" or POST directly
    Production result: extracted 30 new emails from existing job descriptions

All crons:
  → Authentication via verifyCronSecret() (timing-safe, SystemLog on failure)
  → Locking via acquireLock() (try/catch protected, returns false on DB error)
  → Lock release via finally block (no double-release)
  → Cron tracking via cron-tracker.ts (success/error/skipped → SystemLog)
```

### The timeline of one 30-minute cycle

```
:00  Free scrapers fire (every 2h) or paid scrapers fire (daily 6AM)
     ↓ All scrapers save GlobalJobs with isFresh=true
     ↓ Fire-and-forget: instant-apply triggered automatically

:10  MATCH-ALL-USERS CRON fires (every hour)
     → Query fresh GlobalJobs → finds 15 fresh jobs
     → For each active user × each fresh job:
       → computeMatchScore() → 8 hard filters + 7 scoring factors
       → If pass → CREATE UserJob (score, reasons, stage="SAVED")
       → If Semi-Auto and score ≥ 55 → CREATE JobApplication (status="DRAFT")
       → If Full-Auto and score ≥ minScore and emailConfidence ≥ 80 → CREATE JobApplication (status="READY", scheduledSendAt=now+delay)
     → Mark all processed GlobalJobs as isFresh=false

:15  SEND-QUEUED / SEND-SCHEDULED CRON fires
     → Query: JobApplications WHERE status='READY' AND scheduledSendAt <= NOW()
     → For each application (batch of 3):
       → canSendNow() → check all 8 safety layers
       → If allowed → sendApplication() → SMTP → status = "SENT"
       → If rate limited → skip, try next cycle
       → Inter-send delay uses each user's sendDelaySeconds (default 120s, min 1s floor)

:20  NOTIFY-MATCHES fires
     → For users with new matches since last notification
     → Build digest email → send via Brevo

:30  Next scraper cycle starts...
```

---

## PART 5: HOW EMAIL SENDING WORKS

### Three modes, three different flows

```
MANUAL MODE:
  User → clicks "Copy All" → pastes in Gmail → sends manually
  JobPilot never touches email. Just generates text for copying.
  No SMTP setup needed. Safest option.

SEMI-AUTO MODE (DEFAULT):
  AI generates email → user reviews/edits → user clicks "Send" → JobPilot sends via user's SMTP.
  Requires: Email provider (Gmail/Outlook/custom) + credentials configured.

  Flow:
  1. User clicks job → AI generates email
  2. User reviews subject + body → edits if needed
  3. User clicks "Send ▶"
  4. Server: canSendNow() → checks all safety limits
  5. Server: getTransporterForUser() → creates Nodemailer transporter
  6. Server: sendApplication() → sends email with resume attachment
  7. Status: DRAFT → SENT, sentAt = now, stage → APPLIED

FULL-AUTO MODE:
  AI generates email → sends automatically after a delay (cancel window).
  Requires: SMTP configured + readiness check passed.

  Flow:
  1. instant-apply cron runs → matches fresh jobs
  2. Score ≥ minScore → AI generates email automatically
  3. Application created with status = "READY" and scheduledSendAt = now + delay
  4. User can see it in /applications → can cancel/edit within the delay window
  5. send-scheduled cron runs → canSendNow() → sendApplication() → SENT
```

### Action button priority (job detail page)

```
WHEN EMAIL EXISTS (companyEmail present):
  Primary:   "Draft Application" — scrolls to QuickApplyPanel, user can generate & send
  Secondary: "View on Site" — outline button, opens job URL in new tab

WHEN NO EMAIL:
  Primary:   "View on Site" — main action, opens applyUrl/sourceUrl
  "Copy Application Kit" available — name, email, phone, LinkedIn, pitch, cover letter

Rationale: 99% of jobs have no verified email. For those, "View on Site" is the
obvious path. For the 1% with email, "Draft Application" is primary.
```

### Fast Manual Apply Flow

```
"Apply on Site" is now the primary action for most jobs (85% have no verified email).

Flow:
  1. User clicks "Apply on Site" on a job card or detail page
     → Opens the job URL (applyUrl or sourceUrl) in a new tab
  2. On the job detail page, user sees "I Applied" button
     → Clicks it after applying on the external site
  3. markAppliedFromSite(userJobId) creates a JobApplication with:
     - status: "SENT"
     - appliedVia: "PLATFORM"
     - subject: "Applied to [title] at [company]"
     - emailBody: "Applied via [platform or job site]"
  4. UserJob.stage → "APPLIED"
  5. Activity logged (APPLICATION_SENT)

This tracks manual/site applications alongside email applications for unified analytics.

File: src/app/actions/job.ts → markAppliedFromSite()
File: src/app/(dashboard)/jobs/[id]/client.tsx → Apply on Site, I Applied buttons
```

### How sendApplication() works internally

```typescript
async function sendApplication(applicationId) {

  // 1. ATOMIC STATUS UPDATE (prevent double-send)
  //    Change DRAFT/READY → SENDING in a single query
  //    If another process already changed it → skip

  // 2. DUPLICATE CHECK
  //    Has this user already sent to this email for this job? → skip

  // 3. FETCH EVERYTHING
  //    Application + User + Resume + GlobalJob + UserSettings

  // 3.5. DECRYPTION FAILURE CHECK (NEW)
  //    After decryptSettingsFields(), check hasDecryptionFailure()
  //    for smtpPass, smtpUser, applicationEmail
  //    If any critical SMTP field failed decryption:
  //    → Mark application FAILED with "re-save your settings"
  //    → Return immediately (don't attempt send)

  // 4. SENDER VALIDATION (NEW)
  //    Guard: if both applicationEmail AND smtpUser are null → FAILED
  //    Prevents building a transporter with from: <undefined>

  // 5. SAFETY CHECK
  //    canSendNow(userId) → 8-layer check (see below)
  //    If any layer fails → status back to READY, retry next cycle

  // 6. FINAL BODY CLEANUP
  //    cleanJsonField(subject) — strips any lingering raw JSON
  //    cleanJsonField(emailBody) — safety net for corrupted data

  // 7. GET TRANSPORTER
  //    getTransporterForUser(settings) creates Nodemailer transporter:
  //    → Gmail: service: "gmail", auth: { user, pass }
  //    → Outlook: host: "smtp-mail.outlook.com", port: 587
  //    → Custom: user's smtpHost, smtpPort, smtpUser, smtpPass
  //    → Brevo fallback: smtp-relay.brevo.com:587
  //    SMTP password is decrypted from AES-256 encryption

  // 8. PREPARE EMAIL (plain text only — no HTML)
  //    WHY: HTML triggers spam filters. Multipart/alternative structure looks
  //    automated. Plain text from a real Gmail address = highest inbox rate.
  //    from: "Ali Shahid <alishahid.dev@gmail.com>"
  //    to: recipientEmail
  //    subject: cleaned subject
  //    text: cleaned body (plain text only, no HTML)
  //    X-Mailer header suppressed for deliverability

  // 9. ATTACH RESUME (with failure recovery)
  //    if resume.fileUrl exists:
  //    → fetch(fileUrl) → download PDF from Vercel Blob
  //    → contentType: "application/pdf"
  //    → filename: "Ali-Shahid-Resume.pdf" (prevents double .pdf extension)
  //    → ON FAILURE: return app to READY status for retry (not sent without resume)

  // 10. SEND
  //    transporter.sendMail(mailOptions)

  // 11. ON SUCCESS
  //    → status = "SENT", sentAt = now, messageId = result.messageId
  //    → UserJob.stage = "APPLIED"
  //    → Activity logged

  // 12. ON FAILURE (classified by classifyError())
  //    Error types: permanent | transient | rate_limit | auth | network
  //    → permanent: BOUNCED, clear companyEmail from GlobalJob
  //    → auth: FAILED, tell user to fix credentials
  //    → rate_limit: re-queue as READY (don't count as retry)
  //    → transient/network: retryCount++, READY if < 3 attempts, FAILED if >= 3
}
```

### The 8-layer send safety system

```
WHY these layers: Each layer prevents a specific real-world failure mode. All limits are per-user — each user configures their own values in Settings → Sending Safety.
  Layer 1: Paused account → no accidental sends
  Layer 2: Bounce pause → protect reputation after bad emails
  Layer 3: Warmup → new accounts get flagged if they send >5 on day 1
  Layer 4: Provider limits → Gmail/Outlook hard caps
  Layer 5–6: Daily/hourly → prevent "burst then block"
  Layer 7: Min delay → spacing looks human
  Layer 8: Bounce check → stop before reputation damage

Before ANY email is sent, canSendNow() runs 8 checks:

Layer 1: ACCOUNT STATUS
  → Is user's account "active"? (not paused, not off)
  → If paused → blocked

Layer 2: SENDING PAUSE
  → Is sendingPausedUntil in the future? (from bounce auto-pause)
  → If yes → blocked, show when it expires

Layer 3: EMAIL WARMUP
  → Check smtpSetupDate to determine account age
  → Day 1-3:  max 3/day, max 2/hour (new SMTP account)
  → Day 4-7:  max 8/day, max 4/hour (warming up)
  → Day 8+:   user's configured limits (fully warmed up)
  → WHY warmup exists: Gmail/Outlook flag new accounts sending >5 emails
    on day 1 as suspicious. Gradual ramp builds reputation.

Layer 4: PROVIDER LIMITS
  → Detect provider from emailProvider or smtpHost
  → Gmail: 500/day, 60/hour
  → Outlook: 300/day, 30/hour
  → Brevo: 300/day, 60/hour
  → Custom: no hard limits (user's config only)
  → effectiveLimits = min(user config, warmup limits, provider limits)

Layer 5: DAILY LIMIT
  → Count applications with status=SENT and sentAt=today
  → Compare to effectiveMaxPerDay
  → If at limit → blocked, resets at midnight

Layer 6: HOURLY LIMIT + COOLDOWN
  → Count SENT in last 60 minutes
  → Compare to effectiveMaxPerHour
  → If at limit → auto-pause for user's cooldownMinutes (default 30 min)
  → sendingPausedUntil set automatically

Layer 7: MINIMUM DELAY (per-user)
  → Find most recent SENT application
  → Time since last send vs user's sendDelaySeconds (default 120s, configurable 30-600s)
  → Last send 90s ago, delay is 120s → blocked, wait 30s
  → Last send 150s ago → allowed
  → Cron batch sends also use this delay between consecutive emails

Layer 8: BOUNCE CHECK
  → Count BOUNCED applications today — but ONLY "address not found" bounces
  → Patterns: "address not found", "does not exist", "user unknown", "no such user",
    "mailbox not found", "invalid recipient", "undeliverable"
  → Policy rejections (SPF/DKIM, domain blocks) do NOT count toward 3-bounce pause
  → 3+ address bounces → auto-pause for bouncePauseHours (default 24)
  → WHY: "Address not found" = bad email (our fault, stop sending to bad data).
    "Policy rejection" = server rules (not our fault, don't punish user for it).

ALL 8 must pass for the email to be sent.
If ANY fails → application stays as READY → retry next cron cycle.
```

---

## PART 6: HOW THE RESUME SYSTEM WORKS

### Upload flow (PDF only)

```
1. User selects PDF file (only .pdf accepted — DOCX/TXT rejected at upload)
2. File uploaded to Vercel Blob → get fileUrl
3. TWO-STEP TEXT EXTRACTION:

   Attempt 1: pdf-parse v2
   → PDFParse class with { data: buffer }
   → parser.getText() → { text: string }
   → If text.length >= 20 chars → success, use this text

   Attempt 2: pdfjs-dist (Mozilla PDF.js) — fallback
   → Only runs if pdf-parse returns < 20 chars
   → Configured with CMap files + standard font data for complex PDFs:
     {
       data: uint8,
       useSystemFonts: true,
       isEvalSupported: false,
       disableFontFace: true,
       cMapUrl: "node_modules/pdfjs-dist/cmaps/",
       cMapPacked: true,
       standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
     }
   → Iterates all pages → getTextContent() → concatenates text items
   → This handles PDFs with custom font encodings (LaTeX, Canva, design tools)

   If both fail → 0 chars → user prompted to paste text manually

4. STRUCTURED RESUME PARSING (parseResume):
   Input: raw extracted text
   Output: ParsedResume {
     skills: string[]           → canonical skills detected
     sections: {
       summary: string          → professional summary/objective
       experience: string       → work experience section
       education: string        → education section
       skills: string           → dedicated skills section
       projects: string         → projects section
       certifications: string   → certifications section
     }
     yearsOfExperience: number | null  → extracted from date ranges or explicit mentions
     educationLevel: string | null     → "bachelor", "master", "phd", etc.
   }

5. SKILL DETECTION (extractSkillsFromContent):
   → Normalize text (lowercase, strip special chars, handle unicode)
   → Match against SKILL_ALIASES dictionary (200+ canonical skills, each with aliases):
     "JavaScript" matches: "javascript", "js", "ecmascript", "es6"
     "React" matches: "react", "react.js", "reactjs"
     "PostgreSQL" matches: "postgresql", "postgres", "pg", "psql"
   → Prioritize skills found in dedicated "Skills" section (higher confidence)
   → Filter out false positives (single-char skills like "C" or "R" only counted
     if found in a dedicated skills section)
   → Result: detectedSkills: ["JavaScript", "React", "Node.js", "PostgreSQL", ...]

6. QUALITY ASSESSMENT:
   → Word count >= 50 → "good"
   → Printable character ratio >= 50% → not "poor"
   → Otherwise → "empty" or "poor"

7. SAVE TO DATABASE:
   Resume {
     userId, name, fileName, fileUrl, fileType: "pdf",
     content (full text), detectedSkills (JSON array),
     textQuality, targetCategories, isDefault
   }
```

### AI Rephrase feature

```
When user clicks "AI Rephrase" on a resume card:

1. Resume must have content (text) — button only shows when content exists
2. Send content to Groq with a rephrase prompt:
   → "Improve phrasing, use strong action verbs, quantify achievements"
   → "Keep ALL factual information identical — dates, companies, skills, projects"
   → "Preserve structure and sections"
   → "Make it ATS-friendly"
3. AI returns rephrased text → re-run parseResume() to detect skills
4. Save updated content + detectedSkills to database
5. Toast: "Resume rephrased! Detected X skills."
```

### 4-tier resume matching (per job)

```
When a job needs a resume (for QuickApply or auto-send):

Tier 1: CATEGORY MATCH
  Job category: "Frontend"
  Resume A categories: ["Frontend", "React"] → MATCH ✅
  Resume B categories: ["Backend", "Python"] → no match
  → Pick Resume A

Tier 2: SKILL OVERLAP (if tie)
  Job skills: ["React", "TypeScript", "Next.js"]
  Resume A skills: ["React", "TypeScript", "Tailwind"] → 2 overlap
  Resume C skills: ["React", "TypeScript", "Next.js", "Node.js"] → 3 overlap
  → Pick Resume C (more skill matches)

Tier 3: AI TIEBREAKER (if still tied)
  → Send both resumes + job to Groq
  → "Which resume is better for this job? Return the resume ID."
  → Groq picks one

Tier 4: DEFAULT FALLBACK
  If no category match, no skill overlap → use the resume marked as default
```

### Resume page tip

```
When user has < 3 resumes, an amber tip banner shows:

  "Tip: Upload resumes for different tech stacks
   For example, a MERN stack resume, a Next.js resume, and a general
   full-stack resume. The AI picks the best-matching resume for each
   job automatically — more variants means better recommendations
   and higher match scores."

Auto-hides when 3+ resumes are uploaded.
```

---

## PART 7: HOW DATA FLOWS THROUGH THE SYSTEM

### Complete lifecycle of one job

```
WHY the complete job lifecycle matters:
  Understanding which step can fail helps debug any issue. Scraping can miss
  descriptions (LinkedIn 0%). Matching can reject (hard filters). Email can
  be missing (99% of jobs). Sending can bounce. Each stage has distinct
  failure modes and fixes.

BIRTH (scraping):
  cron-job.org → hits /api/cron/scrape-global
  → API returns: { title: "React Dev", company: "TechCorp", ... }
  → categorizeJob() → "Frontend"
  → extractSkills() → ["React", "TypeScript"]
  → prisma.globalJob.upsert() → saved to GlobalJob table
  → isFresh = true

MATCHING:
  10 min later → /api/cron/match-all-users fires
  → Query fresh GlobalJobs → finds this job
  → For User A (keywords: React):
    → computeMatchScore() →
      Hard filter 1: platform ✅
      Hard filter 2: blacklist ✅ (TechCorp not blacklisted)
      Hard filter 3: keyword match ✅ ("React" found)
      Hard filter 4: category ✅ ("Frontend" selected)
      Hard filter 5: country ✅ (remote)
      Hard filter 6: city ✅ (remote)
      → Score: keyword(18) + title(10) + skill(15) + category(10) + location(7) + exp(0) + fresh(5) = 65
      → 65 ≥ 40 → PASS
    → prisma.userJob.create({ matchScore: 65, stage: "SAVED" })
  → For User B (keywords: Python):
    → Hard filter 3: keyword match ❌ → score = 0, REJECTED
  → Mark globalJob.isFresh = false

DISPLAY:
  User A opens dashboard
  → getKanbanJobs(userA) → query UserJobs
  → Filter out blacklisted companies (client-side double check)
  → "React Dev at TechCorp — 65%" appears in SAVED column

EMAIL GENERATION:
  User A clicks the card → QuickApplyPanel opens
  → generateApplicationEmail() server action
  → Pick best resume (4-tier matching)
  → Build AI prompt → call Groq → extract subject/body
  → Strip inline URLs → build signature block with phone/links
  → Save as JobApplication { status: "DRAFT" }
  → User reviews → edits if needed → clicks "Send ▶"

SENDING:
  → canSendNow(userA) → all 8 safety layers pass ✅
  → cleanJsonField(subject/body) → final safety scrub
  → getTransporterForUser(userA) → Gmail SMTP transporter
  → Download resume PDF from Vercel Blob
  → sendMail({ from, to, subject, text, html, attachments: [resume.pdf] })
  → Success! → status = "SENT", sentAt = now
  → UserJob.stage = "APPLIED"
  → Activity logged

FOLLOW-UP:
  7 days later → /api/cron/check-follow-ups fires
  → Checks hasDecryptionFailure for notificationEmail → skip if failed
  → Finds: application sent 7 days ago, no stage change
  → AI generates follow-up draft
  → followUpCount + lastFollowUpAt incremented transactionally with draft save
  → User decides whether to send

BOUNCE (if email fails):
  → Email server rejects → Brevo webhook fires
  → /api/webhooks/email-bounce → status = "BOUNCED"
  → Clear bad email from GlobalJob
  → If 3 bounces today → auto-pause sending for 24 hours

DEATH (cleanup):
  → 7+ days without scraper seeing this job → lastSeenAt is old
  → /api/cron/cleanup-stale → isActive = false
  → Position-filled detection: after HEAD requests, pages returning 200 are
    GET-fetched and checked for "position has been filled", "job is closed",
    "no longer accepting applications" in the first 10KB
  → deleteMany re-checks userJobs: { none: {} } to prevent race with user saves
  → Existing UserJobs remain (user's history preserved)
```

---

## PART 8: HOW ENCRYPTION WORKS

### SMTP password encryption

```
Problem: We store users' Gmail App Passwords in our database.
If someone hacks the database, they'd have everyone's Gmail credentials.

Solution: AES-256 encryption before storing.

STORING (when user saves SMTP password):
  1. User enters: "abcd efgh ijkl mnop" (16-char App Password)
  2. encrypt(plaintext):
     → Generate random IV (initialization vector) — 16 random bytes
     → Use ENCRYPTION_KEY from env (32 random bytes)
     → AES-256-CBC cipher: encrypt(plaintext, key, iv)
     → Output: "iv_hex:ciphertext_hex"
     → Stored in DB: "2d380fcfe95b53cf:cc50b3dec10a0533..."
  3. Original password is NEVER stored

RETRIEVING (when sending email):
  1. Read from DB: "2d380fcfe95b53cf:cc50b3dec10a0533..."
  2. decrypt(encryptedString):
     → Split on ":" → iv_hex + ciphertext_hex
     → Use same ENCRYPTION_KEY from env
     → AES-256-CBC decipher
     → Output: "abcd efgh ijkl mnop" (original password)
  3. Use decrypted password in Nodemailer transporter
  4. Password only exists in memory briefly, never logged

DECRYPTION FAILURE TRACKING:
  If ENCRYPTION_KEY changes (rotation) or data is corrupted:
  → decryptSettingsFields() returns the settings object with a
    _decryptionFailures[] array listing which fields failed
  → Callers use hasDecryptionFailure(settings, "smtpPass", "smtpUser")
    to detect and handle failures explicitly:
    - send-application: marks app FAILED with "re-save settings" message
    - instant-apply: skips user entirely
    - match-all-users: skips notification for that user
    - check-follow-ups: skips follow-up reminder
    - application-email: distinguishes "not set" vs "decryption failed"

Security:
  → Database leaked → attacker sees encrypted gibberish
  → Without ENCRYPTION_KEY → can't decrypt
  → ENCRYPTION_KEY lives in env vars (Vercel), not in database
  → Two separate systems must both be compromised
  → Key rotation detected and surfaced (not silently null)
```

---

## PART 9: HOW NOTIFICATIONS WORK

```
TRIGGER: New matches found during matching cron

Flow:
  1. match-all-users cron finds 5 new matches for User A
  2. Check hasDecryptionFailure(settings, "notificationEmail")
     → If notificationEmail can't be decrypted → skip notification
  3. claimNotificationSlot(userId) atomically:
     → Check daily limit (max 3/day)
     → Check frequency (hourly → max 1/hour, daily → max 1/day)
     → Record notification immediately
     → Re-verify count to prevent concurrent double-sends
     → If race detected → yield to first writer, return false
  4. Filter matches: only include score ≥ 50 (skip low-quality matches)
  5. Build email digest:
     Subject: "JobPilot — 5 New Job Matches"
     Body: Table with job title, company, score, "View" link
  6. Send via SYSTEM transporter (Brevo SMTP, NOT user's Gmail)

NOTIFICATION vs APPLICATION EMAIL:
  ┌─────────────────────────────────────────────────────┐
  │ NOTIFICATION (system → user)                        │
  │ From: JobPilot <noreply@jobpilot.pk> via Brevo      │
  │ To: alishahid.dev@gmail.com                         │
  │ Purpose: "Hey, you have new matched jobs!"          │
  │ Quota: 300/day (Brevo free tier)                    │
  ├─────────────────────────────────────────────────────┤
  │ APPLICATION (user → company)                        │
  │ From: Ali Shahid <alishahid.dev@gmail.com>          │
  │ To: hr@techcorp.com                                 │
  │ Purpose: "I'm applying for your job posting"        │
  │ Quota: 500/day (user's own Gmail limit)             │
  └─────────────────────────────────────────────────────┘
```

---

## PART 10: THE DATABASE SCHEMA

```
User                     ← NextAuth creates this on sign-in
  ├── Account[]          ← OAuth provider accounts (Google, GitHub)
  ├── Session[]          ← Active sessions
  ├── UserSettings       ← All preferences, SMTP creds, mode, limits, blacklist
  ├── Resume[]           ← Uploaded resumes with detectedSkills, sections, quality
  ├── EmailTemplate[]    ← Email templates (subject/body patterns)
  ├── UserJob[]          ← Jobs matched TO this user (their Kanban)
  │   └── JobApplication ← Generated email, send status, follow-up drafts
  └── Activity[]         ← Audit log of all actions

CompanyEmail             ← Persistent company email cache
  ├── companyNorm @unique ← Normalized company name
  ├── email              ← Cached email address
  ├── confidence         ← Email confidence score
  └── source             ← How email was found

GlobalJob                ← ALL scraped jobs (shared across users, no userId)
  ├── sourceId + source  ← @@unique — prevents duplicates
  ├── skills[]           ← Extracted skills (JSON array)
  ├── category           ← Auto-categorized
  ├── companyEmail       ← Extracted/pattern-matched HR email
  ├── isFresh            ← New since last matching cycle
  ├── isActive           ← Still appearing in scrapes
  └── UserJob[]          ← Which users this job was matched to

VerificationToken        ← Magic link / email verification

SystemLog                ← Scrape results, errors, API usage tracking
SystemLock               ← Prevents duplicate cron runs (mutex)

Enums:
  JobStage: SAVED, APPLIED, INTERVIEW, OFFER, REJECTED, GHOSTED
  ApplicationStatus: DRAFT, READY, SENDING, SENT, FAILED, BOUNCED, CANCELLED
  ApplicationMode: MANUAL, SEMI_AUTO, FULL_AUTO, INSTANT
  ApplyMethod: EMAIL, MANUAL, PLATFORM (PLATFORM = applied via job site, tracked with "I Applied")
  ActivityType: STAGE_CHANGE, NOTE_ADDED, APPLICATION_SENT, etc.
```

### Key fields on UserSettings

```
PERSONAL: fullName, phone, linkedinUrl, githubUrl, portfolioUrl
PREFERENCES: keywords[], negativeKeywords[], city, country, salaryMin/Max, experienceLevel,
             education, workType[], jobType[], languages[], preferredCategories[],
             preferredPlatforms[]
BLACKLIST: blacklistedCompanies[] — companies hidden from dashboard, never auto-applied
EMAIL: emailProvider, smtpHost, smtpPort, smtpUser, smtpPass (encrypted), applicationEmail,
       smtpSetupDate (tracked automatically for warmup), smtpVerifiedAt
AI: customSystemPrompt, preferredTone, emailLanguage, includeLinkedin/Github/Portfolio,
    customClosing, defaultSignature, resumeMatchMode
AUTOMATION: applicationMode, autoApplyEnabled, instantApplyEnabled, maxAutoApplyPerDay,
            minMatchScoreForAutoApply, instantApplyDelay
SAFETY: sendDelaySeconds, maxSendsPerHour, maxSendsPerDay, cooldownMinutes,
        bouncePauseHours, sendingPausedUntil
NOTIFICATIONS: emailNotifications, notificationEmail, notificationFrequency

New fields:
  negativeKeywords[] — exclude jobs containing these terms (hard filter)
  smtpSetupDate — auto-set when SMTP is first configured (for email warmup)
```

---

## PART 11: APPLICATION QUEUE & BULK OPERATIONS

```
The Application Queue (/applications) shows all generated emails.

OPTIMISTIC STATE MANAGEMENT:
  After sending an application, the card immediately reflects the new status
  without waiting for a full page refresh. This prevents the critical UX bug
  where a user could click "Send" again on an already-sent application.

  How it works:
  - Parent component (ApplicationQueue) maintains a localStatuses Map<id, status>
  - Each ApplicationCard receives its localStatus and an onLocalStatusChange callback
  - effectiveStatus = localStatus ?? serverStatus (local always takes priority)
  - When "Send" is clicked:
    1. Immediately → localStatus = SENDING (card shows spinner, Send button hidden)
    2. On success  → localStatus = SENT (card grays out, shows green checkmark)
    3. On failure  → localStatus reverts to original (Send button re-appears)
  - Tab badge counts use effectiveCounts (computed from localStatuses)
  - Tab filtering uses getEffectiveStatus() — sent cards disappear from Drafts tab

  Bulk send also uses optimistic updates:
  - Each app transitions DRAFT → SENDING → SENT as it's processed
  - Already-sent apps are excluded from re-selection (getEffectiveStatus filter)
  - The UI updates card-by-card during the batch, not all at once at the end

  Server-side double-send prevention (defense in depth):
  - send-application.ts: atomic claim via updateMany WHERE status IN [DRAFT, READY]
  - API route: returns 400 "Already sent" if status === SENT
  - These ensure that even if the UI fails, the backend won't send twice

EMAIL QUALITY BADGES (per-card):
  Each application card shows an email quality badge next to the recipient email:
  - Verified (green, ShieldCheck)   → emailConfidence >= 80
  - Guessed (amber, ShieldAlert)    → emailConfidence 50-79
  - Unverified (red, ShieldX)       → emailConfidence < 50 or null
  - No email (red, ShieldX)         → no recipientEmail
  Data flows: getApplications() → globalJob.emailConfidence → EmailQualityBadge component

PRE-SEND QUALITY SUMMARY:
  When items are selected, a summary bar appears above the bulk actions:
  "Email quality: 8 verified · 3 guessed · 2 no email"
  Sub-text: "Only verified emails are sent in bulk"
  Helps users understand what will happen before clicking Send.

Features:
  - Filter by status: DRAFT, READY, SENT, FAILED, BOUNCED
  - Select multiple applications with checkboxes
  - Bulk actions with real-time progress bars:

    "Send (6)" → sends selected one-by-one with progress:
      ████████░░░░ Sending 4 of 6 (67%)
      Each send respects canSendNow() safety limits.
      Cards update optimistically as each send completes.

    "Mark All Ready" → changes selected to READY status
      (validates recipientEmail, subject, emailBody are non-empty)
      ████████████ Ready 6 of 6 (100%)

    "Delete Selected" → removes selected applications
      ████████████ Deleted 6 of 6 (100%)

  - Progress bar uses emerald/blue gradient
  - Shows current/total count and percentage
  - Prevents duplicate clicks during operation
  - Sent cards show green confirmation with Copy button (no re-send option)
  - Large batch note: when > 10 selected, shows "Large batches are sent sequentially"

BULK-SEND API QUALITY GATES (/api/applications/bulk-send):
  Before sending, the API applies three filters:
  1. Quality filter: only applications with recipientEmail AND globalJob.emailConfidence >= 80
  2. Dedup by recipient email: keeps only the first application per email address
  3. Cap at 3 per request (Vercel 10s timeout limit)
  Response: { sent, failed, skippedNoEmail, skippedLowConfidence, duplicatesRemoved, results }
```

---

## PART 12: DASHBOARD & DAILY FLOW

### Today's Queue

```
Dashboard shows "Today's Queue" — top 10 scored jobs from the last 48 hours.

Data source: getTodaysQueue()
  - UserJobs from last 48 hours, stage=SAVED, not dismissed, no application yet
  - matchScore >= 40, ordered by score desc, take 15
  - Split into two buckets:

  AUTO-APPLY READY (up to 5):
    Jobs with verified email (companyEmail + emailConfidence >= 70)
    User can send via email directly from the queue

  QUICK APPLY (remaining to reach 10 total):
    Jobs without verified email — "Apply on Site" opens job URL
    User applies externally, then clicks "I Applied" to track

Progress bar: tracks daily application count (X of 10 applied today)
Component: src/components/dashboard/TodaysQueue.tsx
```

### Delivery Stats Widget

```
Dashboard shows weekly application stats:

  - Sent / Bounced / Failed / Drafts (counts)
  - Delivery rate (sent / (sent + bounced) × 100) with week-over-week trend
  - Email vs site breakdown (EMAIL vs PLATFORM/MANUAL appliedVia)
  - Email availability bar chart: verified / unverified / none (jobs in queue)

Data: getDeliveryStats() from analytics actions
Component: src/components/dashboard/DeliveryStats.tsx
```

### Freshness indicators (UI)

```
FreshnessIndicator — job detail page badge:
  Shows how fresh the job is (e.g. "Seen 2 days ago", "Active")
  Renders lastSeenAt, firstSeenAt, isActive
  File: src/components/jobs/FreshnessIndicator.tsx

FreshnessDot — compact dot on cards:
  Kanban JobCard, recommended cards, Application Queue cards
  Colored dots (green ● / yellow ● / orange ● / red ●) by age — green = recent, amber = older, orange = may be filled, red = likely expired
  Same component, compact variant

Files:
  src/components/jobs/FreshnessIndicator.tsx
  src/components/kanban/JobCard.tsx
  src/app/(dashboard)/recommended/client.tsx
  src/components/applications/ApplicationQueue.tsx
```

### Raw data viewer (job detail page)

```
Collapsible "View raw scraper data" section on job detail page.
Shows JSON of: title, company, location, description (truncated), salary,
jobType, experienceLevel, category, skills, source, sourceUrl, applyUrl,
companyUrl, companyEmail, emailConfidence, emailSource, postedDate,
firstSeenAt, lastSeenAt, isActive.

Purpose: Debugging. When a job looks wrong, admins/developers can inspect
exactly what the scraper stored. Toggle "Hide" / "View" to expand/collapse.

File: src/app/(dashboard)/jobs/[id]/client.tsx
```

### Quick Apply Kit

```
Job detail page includes copy-to-clipboard buttons for all user profile data:

  - Name (fullName)
  - Email (applicationEmail)
  - Phone
  - LinkedIn URL
  - Portfolio URL
  - GitHub URL
  - AI-generated pitch (3-4 sentences) — via POST /api/jobs/generate-pitch
  - AI-generated cover letter — same endpoint

User clicks "Apply on Site" → opens job URL → pastes each field as needed.
Each button copies to clipboard with feedback (checkmark on success).

Component: src/components/jobs/QuickApplyKit.tsx
```

---

## PART 13: COMPANY BLACKLIST

```
Settings → "Company Blacklist" section

Purpose: Hide jobs from specific companies (e.g., current employer)

How it works:
  1. User types company name → clicks "Block"
  2. Saved to UserSettings.blacklistedCompanies[] (array of strings)
  3. Matching engine: Hard Filter 2 rejects any job where
     company name matches blacklist (case-insensitive, substring match)
  4. Dashboard: client-side filter also removes blacklisted companies
  5. Never auto-applied to blacklisted companies

Matching logic:
  blacklist: ["acme corp"]
  job company: "Acme Corporation" → "acme corporation".includes("acme corp") → BLOCKED
  job company: "TechCorp" → no match → ALLOWED
```

---

## PART 14: NEGATIVE KEYWORDS

```
Settings → "Job Preferences" tab → "Negative Keywords" section

Purpose: Exclude jobs containing specific terms (the inverse of keywords)

How it works:
  1. User types term (e.g., "wordpress", "php", "internship") → clicks "Add"
  2. Saved to UserSettings.negativeKeywords[] (array of strings, max 50)
  3. TWO enforcement points:
     a) recommendation-engine.ts (Path A, query-time):
        Before keyword matching, jobs are checked against negativeKeywords.
        If ANY negative keyword appears in title/description/skills → job removed.
     b) score-engine.ts (Path B, background + shared scoring):
        Hard Filter 3 rejects jobs matching any negative keyword → score 0.
  4. Result: Job never appears on dashboard or gets auto-applied

Example:
  Keywords: ["React", "TypeScript"]
  Negative keywords: ["wordpress", "php"]
  Job: "React WordPress Developer" → matches "wordpress" → REJECTED
  Job: "React TypeScript Engineer" → no negative match → PASSES → scored normally
```

---

## PART 15: EMAIL WARMUP

```
New SMTP accounts need to "warm up" — sending too many emails immediately
can get the account flagged as spam.

How it works:
  1. When user first configures SMTP (smtpUser + smtpPass), the system records
     smtpSetupDate = now (in saveSettings action)
  2. canSendNow() checks smtpSetupDate via getWarmupLimits():
     Day 1-3:  max 3 emails/day, max 2/hour  (building reputation)
     Day 4-7:  max 8 emails/day, max 4/hour  (warming up)
     Day 8+:   user's configured limits       (fully warmed)
  3. Effective limit = min(user's maxSendsPerDay, warmup limit)
  4. UI messages inform user: "Email warmup: Day 3/7 — limit 3/day"

File: src/lib/send-limiter.ts → getWarmupLimits(), canSendNow()
Field: UserSettings.smtpSetupDate (auto-set, not user-editable)
```

---

## PART 16: KEYWORD EFFECTIVENESS ANALYTICS

```
Analytics page → "Keyword Effectiveness" section

Purpose: Show users which keywords produce good matches and which don't

How it works:
  1. getAnalytics() loads user's keywords[] from UserSettings
  2. Queries all UserJob records for the user
  3. For each keyword, counts:
     - matches:   job title, skills, or matchReasons contain the keyword
     - saves:     matched + stage changed (not dismissed)
     - dismisses: matched + isDismissed = true
     - applied:   matched + stage = APPLIED or later
  4. Sorted by match count (highest first)
  5. Displayed with progress bars and "usefulness" labels

Actionable insight:
  "react: 28 matches, 15 applied" → good keyword, keep it
  "docker: 0 matches" → not matching any jobs, consider removing
  "python: 12 matches, 10 dismissed" → matching wrong jobs, maybe add to negativeKeywords

File: src/app/actions/analytics.ts
Component: src/components/analytics/KeywordEffectiveness.tsx
```

---

## PART 17: EMAIL CONFIDENCE & DELIVERABILITY

```
Every company email is assigned a numeric confidence score (0-100):

Email extraction strategies and their scores:
  1. description_text        → 85–95 (extractEmailFromText from job description)
     Base 85, +10 for hiring prefix (hr@, careers@), -10 for personal pattern
  2. hiring_post             → 90 (email found in social media hiring post)
     Override confidence for google-hiring-posts scraper (high-quality context)
  3. careers_page            → 82 (real email found on company's careers page)
     Raised from 80 — scraped-from-page reliability is high
  4. pattern_guess (RCPT verified) → 35 (guessed "careers@domain.com", mailbox exists)
     Lowered from 40 — guessed emails bounce more than in-text finds
  5. best_guess_unverified   → 20 (guessed, no verification)
  6. none                    → 0  (no email found)

Auto-send gate: emailConfidence >= 80
  Score 85–95 (description_text):  AUTO-SEND ✅
  Score 90 (hiring_post):          AUTO-SEND ✅
  Score 82 (careers_page):         AUTO-SEND ✅
  Score 35 (pattern_guess):        DRAFT only (too risky for auto-send)
  Score 20 (unverified):           DRAFT only

Bulk-send gate: emailConfidence >= 80
  The /api/applications/bulk-send endpoint applies quality filtering:
  - Only sends to apps where globalJob.emailConfidence >= 80 AND has recipientEmail
  - Deduplicates by recipient email (keeps first per address)
  - Skipped apps are counted: skippedNoEmail, skippedLowConfidence, duplicatesRemoved

On bounce:
  → classifyError() determines error type
  → Permanent: clear companyEmail + emailConfidence + emailSource from GlobalJob
  → Never auto-send to that email again

Deliverability improvements:
  → Plain text emails only (no HTML wrapper)
  → X-Mailer header suppressed (no "Nodemailer" fingerprint)
  → Provider-aware rate limits (Gmail 500/day, Outlook 300/day)

Error classification (classifyError()):
  permanent  → bad address, relay denied (codes 550-556) → BOUNCED
  transient  → temporary server issue → retry up to 3x
  rate_limit → too many connections → re-queue without counting retry
  auth       → bad credentials → FAILED, tell user to fix settings
  network    → timeout, connection refused → retry up to 3x

Kanban JobCard email badges:
  Green Mail icon when emailConfidence >= 80; amber when lower; globe icon (🌐) when no email.
  Data: useJobStore GlobalJobData includes emailConfidence; actions/job.ts Kanban query selects it.

Files:
  src/lib/extract-email-from-text.ts → extractEmailFromText() (85–95 confidence, runs during scrape)
  src/lib/email-extractor.ts    → findCompanyEmail() with confidence scores (careers_page 82, pattern_guess 35)
  src/lib/scrapers/google-hiring-posts.ts → hiring post emails at confidence 90
  src/lib/email-errors.ts       → classifyError() error taxonomy
  src/lib/send-application.ts   → send logic with error classification
  src/lib/send-limiter.ts       → provider-aware limits, bounce patterns (address-not-found only)
  src/app/api/applications/bulk-send/route.ts → quality filter + dedup before bulk sending
  GlobalJob.emailConfidence     → stored numeric confidence (0-100)
  GlobalJob.emailSource         → extraction method used
```

---

## PART 18: USER FEEDBACK SYSTEM

```
Users can submit feedback directly from the app via a floating widget.

How it works:
  1. Floating "Feedback" button appears on all dashboard pages (bottom-right)
  2. User clicks → modal opens with type selector + text area
  3. Types: Bug Report, Suggestion, Compliment, Other
  4. Message (5-2000 chars) + current page path auto-captured
  5. Submitted via server action → saved to UserFeedback table
  6. Success animation shows "Thank you!" then auto-closes

Admin panel (/admin/feedback):
  → View all feedback with user info, timestamps, type/status badges
  → Filter by status (new/reviewed/resolved/dismissed) and type
  → Expand to read full message
  → Add admin notes
  → Update status (Reviewed → Resolved → Dismissed)

Database: UserFeedback model
  userId, type, message, page, status, adminNote, createdAt

Files:
  src/components/shared/FeedbackWidget.tsx  → floating feedback UI
  src/app/actions/feedback.ts               → submitFeedback() server action
  src/app/(admin)/admin/feedback/page.tsx   → admin feedback management
  src/app/api/admin/feedback/route.ts       → GET (list) + PATCH (update status)
```

---

## PART 19: ADMIN DASHBOARD

### Authentication

```
Admin panel supports two auth methods:

1. OAuth (email-based):
   → If user signs in with Google/GitHub and their email is in ADMIN_EMAILS env var
   → They see "Admin Panel" link in the sidebar

2. Credential-based:
   → Username/password from ADMIN_USERNAME + ADMIN_PASSWORD env vars
   → Session stored in httpOnly cookie (8h TTL, HMAC-SHA256 signed)
   → Login at /admin/login
```

### Dashboard (/admin)

```
The admin dashboard provides a full system overview with actionable controls:

TOP STATS (8 cards):
  Users | Active Jobs | Drafts | Ready | Sent Today | Failed | Bounced | Total Sent

RECENTLY ACTIVE USERS (NEW):
  Grid of up to 20 users active in the last 24 hours.
  Each user shows:
  - Avatar (image or initial) with online/offline indicator dot
  - Name + application mode badge (SEMI_AUTO, FULL_AUTO, etc.)
  - "Online now" (green, pulsing) or relative time ("3h ago", "2d ago")
  - Joined date (relative)
  Header shows count of users currently online.

SCRAPER HEALTH:
  All 8 sources with:
  - Health status (green/red dot)
  - Last run time (relative)
  - Total active jobs per source
  - Last scrape message
  - Individual trigger button

JOB DISTRIBUTION:
  Bar chart of jobs by source with percentages
  Shows which scrapers are producing the most results

CRON JOBS & ACTIONS (10 cron jobs):
  - scrape-global, match-jobs, match-all-users, instant-apply
  - send-scheduled, send-queued, notify-matches
  - cleanup-stale, follow-up, check-follow-ups
  Each shows:
  - Running status (animated pulse if active)
  - Last run time
  - Manual trigger button

QUICK ACTIONS:
  - Send Scheduled → trigger /api/cron/send-scheduled
  - Send Queued → trigger /api/cron/send-queued
  - Cleanup Stale → trigger /api/cron/cleanup-stale
  - Match All → trigger /api/cron/match-all-users

API QUOTAS:
  - JSearch: X/200 per month
  - Groq: X/14,400 per day
  - Brevo: X/300 per day
  Progress bars with warning (amber at 80%) and danger (red at 95%) thresholds

ACTIVE LOCKS:
  Shows SystemLock entries currently running (prevents duplicate cron runs)

RECENT ERRORS (24h):
  Scrollable list of SystemLog entries with type=error
```

### Scrapers Page (/admin/scrapers)

```
Dedicated scraper management with:

SUMMARY CARDS:
  Healthy count | Unhealthy count | Total jobs | Source count

PER-SOURCE CARDS (8 cards):
  - Health badge (Healthy/Error)
  - Last run time (relative)
  - Last scrape stats (X new, Y updated)
  - Total active jobs from this source
  - Last message and error details
  - Collapsible "Recent runs" section per scraper (recentLogs from stats API)
  - Individual trigger button

REMOVED: "Scrape Posts" button — LinkedIn posts run inside scrape-global as linkedin_posts.

TOP ACTIONS:
  - Refresh: reload stats
  - Trigger All: fire all 8 scrapers sequentially
  - Scrape Global: trigger /api/cron/scrape-global (aggregated mode)
  - Backfill Emails: trigger POST /api/admin/backfill-emails (one-time extraction from descriptions)
```

### Users Page (/admin/users)

```
User management table with enhanced activity tracking:
  Columns: User (avatar+name+email) | Status | Mode | Sent Today | Total Apps | Last Active | Joined | Actions

  New features:
  - Online status indicators: green pulsing dot = active in last 5 min, gray dot = offline
  - Relative timestamps: "Online", "3h ago", "2d ago" for Last Active and Joined columns
  - Sortable columns: click User, Sent Today, Total Apps, Last Active, or Joined to sort asc/desc
  - Online count in header: "X users · Y online now"
  - Hover tooltips show exact datetime for Last Active and Joined

  Actions per user: Pause, Activate, Reset Sending, Delete
```

### Logs Page (/admin/logs)

```
System logs viewer with:
  Filters: type (scrape, error, apply, send, etc.) + source (8 scrapers + groq + system)
  Paginated table with expandable metadata (JSON)
  Color-coded type badges
```

### Admin API Routes

```
GET  /api/admin/stats          → Aggregated dashboard data (users, jobs, pipeline, scrapers, crons, locks, quotas, errors)
GET  /api/admin/scrapers       → Scraper health data
POST /api/admin/scrapers/trigger → Trigger any scraper or cron action
     body: { source: "indeed" | "all" | "instant-apply" | "send-queued" | "cleanup-stale" | etc. }
GET  /api/admin/users          → List all users with stats
PATCH/DELETE /api/admin/users/[id] → User actions (pause, activate, reset_sending, delete)
GET  /api/admin/logs           → Paginated system logs with filters
GET  /api/admin/quotas         → API quota usage
POST /api/admin/cleanup-matches → Rescore job matches
POST /api/admin/auth           → Credential login
DELETE /api/admin/auth         → Logout
```

---

## PART 20: USER ACTIVITY TRACKING

```
JobPilot tracks when users are actively using the app to provide
admin visibility into user engagement.

How it works:
  1. ActivityTracker component (invisible) mounts in dashboard layout
  2. On page load → POST /api/heartbeat → updates UserSettings.lastVisitedAt
  3. Every 5 minutes → another heartbeat ping while user stays on any dashboard page
  4. This means lastVisitedAt is always within 5 minutes of actual activity

Admin visibility:
  - Admin Dashboard: "Recently Active Users" card shows up to 20 users from last 24h
  - Admin Users Page: "Last Active" column with online indicator (green = last 5 min)
  - Both pages show relative time ("just now", "3h ago", "2d ago")
  - Header shows live online count

Online detection threshold: 5 minutes
  User with lastVisitedAt within 5 min → green dot + "Online now"
  User with lastVisitedAt older → gray dot + relative time

Files:
  src/components/shared/ActivityTracker.tsx  → heartbeat client component
  src/app/api/heartbeat/route.ts            → lightweight lastVisitedAt updater
  src/app/(dashboard)/layout.tsx            → mounts ActivityTracker
  src/app/api/admin/stats/route.ts          → queries recently active users
  src/app/(admin)/admin/page.tsx            → renders Recently Active Users card
  src/app/(admin)/admin/users/page.tsx      → renders enhanced users table
```

---

## PART 21: PERFORMANCE OPTIMIZATIONS

### What was slow and how it was fixed

```
BOTTLENECK                                 FIX                                      IMPACT
───────────────────────────────────────────────────────────────────────────────────────────────
Scrape-global ran scrapers sequentially   Promise.allSettled — all scrapers parallel  Eliminates timeout
Dashboard fetches settings THEN jobs       Promise.all for parallel fetching         -400ms
getSettings() loads 50+ fields, uncached   React cache() + unstable_cache (5min)     -300ms
No DB connection pooling                   pgbouncer=true, connection_limit=5        -200ms
All pages force-dynamic                    Removed redundant force-dynamic exports    Faster renders
Vercel/Neon region mismatch                vercel.json regions: ["iad1"]             -500ms
Full globalJob loaded on detail page       Prisma select for needed fields only      -200ms
SettingsForm 2300 lines, all tabs render   Controlled tabs + next/dynamic import     -500ms JS
Charts/OnboardingWizard always loaded      next/dynamic lazy loading                 -150ms JS
New SMTP connection per email              Connection pool cache (10min TTL)         -3s/batch
Unused @dnd-kit/sortable in bundle         Removed from package.json                -30KB
```

### Architecture decisions

```
DATA FETCHING:
  Every page uses Promise.all for parallel data loading.
  getSettings() → cached per request (React cache) + across requests (unstable_cache, 5min TTL).
  getSettingsLite() → select only subset of fields for non-settings pages.
  Invalidation: revalidateTag("settings-{userId}") on settings save.
  All 8 dashboard pages had redundant force-dynamic removed — layout auth already forces dynamic.

DATABASE:
  Neon pooled connection via pgbouncer (port 5432).
  connection_limit=5 per serverless function instance.
  27 composite indexes across models for common query patterns.
  Prisma query logging enabled in development.

FRONTEND:
  SettingsForm → next/dynamic with ssr:false from settings page.
  Tab content → only active tab renders (controlled Tabs + conditional mount).
  Charts (recharts) → dynamically imported on analytics page.
  OnboardingWizard → dynamically imported on dashboard page.
  TemplateEditor → dynamically imported on templates page.

SMTP:
  Transporters cached in Map keyed by provider+user+host+port.
  10-minute TTL, pool:true with maxConnections:3.
  System transporter (Brevo) is a singleton.

DEPLOYMENT:
  Vercel function region: iad1 (matches Neon us-east-1).
  Build output: First Load JS shared = ~88KB.
  No page exceeds 35KB individual JS.
```

---

## PART 22: PRODUCT STRATEGY (Current Direction)

### The core insight

```
After 3-4 days of running:
  - Scrapers found 6,000+ jobs ✅
  - Matching engine scored and filtered correctly ✅
  - 85% of jobs have NO email or a guessed email that bounces ❌
  - Zero interviews from email auto-apply ❌

The delivery mechanism (email) is broken for most jobs.
Email auto-apply works for ~15% of jobs with verified emails.
The other 85% need a different application path.
```

### The pivot

```
BEFORE: "We automatically email companies for you"
  Problem: 85% bounce or don't exist. Zero interviews.

AFTER: "We find the best jobs, score them, and make applying take 90 seconds"
  - Apply on Site (primary action for 85% of jobs)
  - Copy-to-clipboard kit (name, email, phone, LinkedIn, cover letter, pitch)
  - Daily application queue (top 10 jobs, 20-minute morning routine)
  - Track all applications in one place (email + site + LinkedIn + referral)
  - Email auto-apply as a bonus for the ~15% with verified emails

The value is FINDING and ORGANIZING the right jobs.
The application step is ACCELERATED, not replaced.
```

### Implemented features (WEEK 1 — Apply flow + tracking)

```
  ✅ "Apply on Site ↗" as primary action (email becomes secondary)
  ✅ Quick Apply Kit: copy buttons for name, email, phone, LinkedIn, portfolio, GitHub,
     AI-generated pitch, and cover letter (POST /api/jobs/generate-pitch)
  ✅ Daily application queue: top 10 jobs from last 48 hours, split by Auto-Apply Ready
     (verified email, confidence >= 70) vs Quick Apply (open site)
  ✅ Track manual applications: "I Applied" → creates JobApplication with appliedVia: "PLATFORM"
  ✅ Delivery Stats widget: weekly sent/bounced/failed/drafts, delivery rate with WoW trend,
     email vs site breakdown, email availability bar chart
  ✅ Bulk operations: checkboxes, bulk dismiss/save/delete, filter-based actions
```

### Planned features

```
WEEK 2 — Browser extension MVP:
  - Chrome extension for LinkedIn and Indeed
  - Shows match score on any job page
  - Save to JobPilot, Copy Cover Letter, Copy Pitch, Mark as Applied

WEEK 3 — Analytics + engagement:
  - Unified application tracking (email + site + LinkedIn + referral)
  - Status pipeline: Applied → Replied → Interview → Offer
  - Conversion funnel by application channel
  - Weekly report email with keyword optimization suggestions
  - Daily digest email with top matches
```

---

## SUMMARY: The Complete Flow in One Sentence

```
Cron scrapes 8 job sites every 30 minutes → extractEmailFromText runs on every
description during scrape → saves to shared GlobalJob table → 10 minutes later,
another cron scores each fresh job against each user's keywords/categories/
skills/blacklist using 8 hard filters + 7 scoring factors → creates UserJob for
matches above 40% → user opens app and sees personalized Kanban board with
FreshnessDot badges → for jobs with verified email (confidence ≥80): "Draft
Application" primary, AI generates 100-150 word email, sent via user's own
Gmail/Outlook SMTP → for jobs without email (99%): "View on Site" primary,
Copy Application Kit available → 8-layer safety system enforces rate limits,
bounce auto-pause counts only "address not found" bounces → follow-ups
auto-drafted after 7 days → raw data viewer on job detail for debugging →
admin backfill-emails for one-time extraction from existing descriptions.
```

That's the entire engine. Every piece connects to the next.
