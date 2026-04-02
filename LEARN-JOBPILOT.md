# Learn JobPilot (JobApplier) — Complete Breakdown

> "Read it → Google what you don't know → Explain it out loud"

---

## WHAT THIS PROJECT IS

JobPilot automatically applies to jobs for you. It scrapes 9+ job boards, matches jobs to your profile using ML scoring, and sends personalized application emails via a 4-agent AI pipeline — all without you lifting a finger.

**User flow:** Set preferences → scrapers find jobs → ML scores matches → 4-agent AI writes email → auto-send

---

## THE TECH STACK

| Tech | What It Is | Why |
|------|-----------|-----|
| **Next.js 14** | React framework | Frontend + API routes |
| **Prisma** | Database ORM | TypeScript-first SQL |
| **PostgreSQL** | Database | Relational data, jobs, users |
| **Groq** | Primary LLM | Llama 3.1 8B (fast, cheap) |
| **Gemini** | Vision AI | Extract JD from images |
| **NextAuth** | Auth | Google + GitHub login |
| **Nodemailer** | Email sending | Multi-SMTP support |
| **Zustand** | State management | Simple client state |
| **SWR** | Data fetching | Stale-while-revalidate |

---

## PROJECT STRUCTURE

```
src/
├── app/
│   ├── (admin)/         ← Admin panel (scrapers, feedback, users)
│   ├── (dashboard)/     ← Main app (jobs, applications, analytics)
│   ├── (landing)/       ← Marketing page
│   └── api/             ← 40+ API endpoints + 13 cron jobs
│
├── components/          ← React components
│   ├── admin/           ← Admin UI
│   ├── applications/    ← Application cards, pipeline view
│   ├── jobs/            ← Job listings
│   ├── kanban/          ← Kanban board for application tracking
│   └── ui/              ← Base components
│
├── lib/
│   ├── agents/          ← THE 4-AGENT PIPELINE (core feature)
│   ├── ai/              ← AI utilities (quality scoring, followups)
│   ├── matching/        ← Job matching engine (score, recommend, filter)
│   ├── ml/              ← Machine learning scorer
│   ├── scrapers/        ← 9+ job board scrapers
│   ├── email/           ← Email templates, notifications
│   └── analytics/       ← A/B testing, send timing
```

---

## PHASE 1: The 4-Agent Pipeline (Core Feature)

This is EVERYTHING. Read these files in order:

### Agent 1: Company Researcher
**File:** `src/lib/agents/researcher.ts`
- Input: company name
- Process: Google Custom Search → fetch website → extract with AI
- Output: `{ mission, values[], techStack[], recentNews, culture }`
- Temperature: 0.3 (factual, not creative)

### Agent 2: Resume Tailor
**File:** `src/lib/agents/resume-tailor.ts`
- Input: your skills[], job description, job title
- Process: match skills to JD requirements → find keyword gaps
- Output: `{ relevantSkills[], bulletSuggestions[], missingKeywords[] }`
- Temperature: 0.4

### Agent 3: Email Writer
**File:** `src/lib/agents/email-writer.ts`
- Input: CompanyResearch + TailoredResume + job details
- Process: write personalized email using company values + your skills
- Output: `{ subject, body (100-150 words), coverLetter (200-300 words) }`
- Temperature: 0.7 (creative but controlled)
- Rules: must mention company values, must include call-to-action

### Agent 4: QA Checker
**File:** `src/lib/agents/qa-checker.ts`
- Input: email subject + body + job description
- Process: score quality, detect spam triggers, check personalization
- Output: `{ score (1-10), issues[], suggestions[], spamScore (0-10) }`
- Temperature: 0.3 (deterministic evaluation)

### Pipeline Orchestrator
**File:** `src/lib/agents/pipeline.ts`
- Runs all 4 agents SEQUENTIALLY: Researcher → Tailor → Writer → QA
- Each agent's output becomes the next agent's input
- API: `POST /api/applications/pipeline`

**Can you explain?**
- [ ] Why 4 separate agents instead of one big prompt? (specialization = better results)
- [ ] Draw the data flow: Agent 1 → Agent 2 → Agent 3 → Agent 4
- [ ] Why different temperatures? (research needs facts, writing needs creativity, QA needs precision)
- [ ] What's the difference between this and LangGraph? (sequential vs graph with conditionals)

---

## PHASE 2: ML Scoring Engine

### Logistic Regression Scorer
**File:** `src/lib/ml/scorer.ts`
- Extracts 7 features from each job:
  1. Keyword overlap (weight 2.0)
  2. Title relevance (1.5)
  3. Salary fit (1.0)
  4. Location match (0.8)
  5. Experience fit (0.7)
  6. Category match (0.5)
  7. Platform preference (0.3)
- Sigmoid function: `1 / (1 + Math.exp(-x))` → converts to 0-100 score
- **Training:** `trainFromUserBehavior()` — adjusts weights based on what user SAVED, APPLIED, got INTERVIEW, or REJECTED
- 20 iterations of stochastic gradient descent, learning rate 0.1

**Can you explain?**
- [ ] What's a sigmoid function? Draw it (S-curve, maps any number to 0-1)
- [ ] What's gradient descent? (adjust weights to reduce prediction error)
- [ ] Why train on user behavior? (each user has different preferences)
- [ ] What are the 7 features? Which has the highest weight?

### Match Score Engine
**File:** `src/lib/matching/score-engine.ts`
- Hard filters (reject before scoring): blacklisted companies, negative keywords, location constraints
- Soft scoring: 7 weighted factors
- 300+ technology variant mappings: "MERN" → React, Node, MongoDB, Express

### Recommendation Engine
**File:** `src/lib/matching/recommendation-engine.ts`
- Multi-stage pipeline:
  1. SQL Stage 1: load ~2000 candidate jobs (light query)
  2. Hard filters: location, blacklist, negative keywords
  3. Keyword matching: two-pass (title+skills first, then full description)
  4. Description loading: lazy-load only for borderline jobs
  5. Scoring: `computeMatchScore()` per job
  6. Dedup: normalize company names (Inc/LLC/Ltd)
  7. Sort + paginate

---

## PHASE 3: Job Scrapers

**Files:** `src/lib/scrapers/`

| Scraper | Source | Method |
|---------|--------|--------|
| `arbeitnow.ts` | ArbeitNow | REST API |
| `adzuna.ts` | Adzuna | REST API |
| `indeed.ts` | Indeed | Web scraping |
| `linkedin.ts` | LinkedIn | Web scraping |
| `remotive.ts` | Remotive | REST API |
| `rozee.ts` | Rozee.pk | REST API |
| `google-jobs.ts` | Google Jobs | Web scraping |
| `google-hiring-posts.ts` | Google Hiring | Web scraping |
| `jsearch.ts` | JSearch API | REST API |

**Supporting files:**
| File | What It Does |
|------|-------------|
| `scraper-runner.ts` | Orchestrates all scrapers with concurrency control |
| `source-rotation.ts` | Rotates sources to avoid rate limiting |
| `fetch-with-retry.ts` | HTTP fetch with exponential backoff |
| `keyword-aggregator.ts` | Combines user preferences into search keywords |
| `post-scrape-enrichment.ts` | Enriches jobs with metadata after scraping |

---

## PHASE 4: Email System

**File:** `src/lib/email.ts`
- Multi-SMTP support: Gmail, Outlook, Brevo, Custom
- Transporter pooling with TTL cache (10 min expiry)
- AES-256 encryption for stored SMTP passwords (`encryption.ts`)

**AI Email Generation:**
| File | What It Does |
|------|-------------|
| `ai-email-generator.ts` | Full email generation with tone/language selection |
| `ai-cover-letter-generator.ts` | Cover letter (200-350 words) |
| `ai-pitch-generator.ts` | Short pitch for ATS forms (3-4 sentences) |
| `ai/generate-followup.ts` | Follow-up emails after initial application |
| `ai/quality-scorer.ts` | Scores email quality 1-10 |
| `ai-fallback.ts` | Template-based fallback when AI fails |

**Email features:**
- Tone selection: professional, confident, friendly, casual, formal
- Multi-language support
- Custom signatures and closings
- Spam trigger detection (ALL CAPS, spam keywords)
- Retry if email body < 80 words

---

## PHASE 5: Cron Automation

13 cron endpoints that run automatically:

| Cron | What It Does |
|------|-------------|
| `scrape-global` | Scrape all job boards |
| `scrape/[source]` | Scrape specific source |
| `match-all-users` | Match new jobs to all users |
| `match-jobs` | Match jobs to specific user |
| `notify-matches` | Send match notifications |
| `instant-apply` | Auto-send for score >= 65 |
| `send-queued` | Send queued applications |
| `send-scheduled` | Send time-scheduled applications |
| `follow-up` | Send follow-up emails |
| `check-follow-ups` | Check if follow-ups needed |
| `cleanup-stale` | Remove old expired jobs |
| `weekly-report` | Weekly digest email |
| `scrape-posts` | Scrape social media job posts |

**The instant-apply flow:**
1. Cron triggers
2. Find users with mode = "FULL_AUTO" or "INSTANT"
3. Get fresh unmatched jobs
4. Score each job against user profile
5. If score >= 65: run 4-agent pipeline → send email
6. Create jobApplication record with status "SENT"
7. Send push notification to user

---

## PHASE 6: Database Schema

**File:** `prisma/schema.prisma`

| Model | Purpose |
|-------|---------|
| `User` | User accounts with settings |
| `Resume` | Multiple resumes per user |
| `Job` | Scraped job listings |
| `UserJob` | Job-user matches with scores |
| `Application` | Sent applications (draft, ready, sent) |
| `UserSettings` | Preferences, SMTP config (encrypted) |
| `Template` | Email templates for A/B testing |
| `SystemLog` | Activity audit trail |

---

## PHASE 7: Streaming & Vision AI

**Streaming pitch generation:**
- `src/hooks/use-streaming-pitch.ts` — React hook for streaming UI
- `src/app/api/jobs/generate-pitch/route.ts` — SSE endpoint
- Words appear one-by-one (like ChatGPT)

**Image-based JD extraction:**
- `src/lib/ai/extract-jd-from-image.ts` — Gemini Vision
- Upload photo of job billboard/newspaper → extract title, company, requirements

---

## PHASE 8: Analytics

| File | What It Does |
|------|-------------|
| `analytics/ab-testing.ts` | Compare email templates by response rate |
| `analytics/send-timing.ts` | Optimal time to send applications |

---

## STUDY ORDER

```
Day 1:  Project structure — know where everything lives
Day 2:  The 4-agent pipeline (Phase 1) — core feature
Day 3:  ML scoring (Phase 2) — logistic regression + sigmoid
Day 4:  Recommendation engine (Phase 2) — multi-stage matching
Day 5:  Scrapers (Phase 3) — how job data is collected
Day 6:  Email system (Phase 4) — SMTP, encryption, generation
Day 7:  Cron automation (Phase 5) — the instant-apply flow
Day 8:  Database schema (Phase 6)
Day 9:  Streaming + vision (Phase 7)
Day 10: Review — explain the whole system
```
