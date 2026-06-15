# Scrapers — quota landscape + what to do today

## How the daily-budget enforcer works (new)

`src/lib/scrapers/quota-budget.ts` now divides each monthly free tier by 30
and caps today at that slice. Every paid scraper calls `canMakeApiCall()`
before its first upstream call; when today's slice is gone (or the monthly
cap is gone), the scraper returns `[]` early and the runner records it as
`skipped`. No circuit-breaker trip, no quota burn, the month survives.

| Upstream | Free monthly | Daily slice = ⌊M÷30⌋ | Used by |
|---|---|---|---|
| **serpapi** | 250 | **8/day** | rozee + google |
| **jsearch** (RapidAPI) | 200 | **6/day** | jsearch + indeed |
| **adzuna** | 7,500 (250/day × 30) | **250/day** | adzuna |
| **groq** | 432,000 (≈14.4k/day × 30) | **14,400/day** | LLM calls |
| **brevo** | 9,000 (300/day × 30) | **300/day** | transactional email |

### Override the cap when you upgrade a plan

```env
SERPAPI_MONTHLY_BUDGET=5000      # SerpAPI $50 tier → 5,000/mo → 166/day
JSEARCH_MONTHLY_BUDGET=10000     # RapidAPI PRO $10 → 10,000/mo → 333/day
```

The enforcer reads these immediately — no code change. Strip the env
to drop back to the free-tier defaults.

### Bypass for tests / debug

```env
ENFORCE_API_BUDGET=0   # disable the gate, scrapers will hit the upstream regardless
```



One-page reference for "which scraper costs what, and what's it doing right now."

Probe values are from `node scripts/probe-scrapers.mjs` run on 2026-06-15.
Re-run anytime to refresh.

## Tier matrix

| Source | Tier | Upstream | Free tier limit | Quota state | Action |
|---|---|---|---|---|---|
| **arbeitnow** | Free | arbeitnow.com REST | Unlimited | ✅ working | Keep on |
| **remotive** | Free | remotive.com REST | Unlimited | ✅ working | Keep on |
| **linkedin** | Free | LinkedIn jobs HTML scrape | Unlimited (until they block) | ✅ working (627 jobs) | Keep on |
| **linkedin_posts** | Free | Google Search HTML for `site:linkedin.com/posts hiring` | Unlimited (Google might rate-limit) | ⚠️ 0 jobs total | Investigate separately — not a quota issue |
| **adzuna(us/uk/in/…)** | Free (low cap) | adzuna.com REST | 250 calls/day | ✅ working (US has 253k jobs) | Keep on for supported countries |
| **adzuna(pk)** | n/a | — | — | ❌ no PK endpoint (fixed in 607317b: falls back to ADZUNA_COUNTRY) | Done — no action |
| **jsearch** | Paid | RapidAPI JSearch | 200 reqs/month BASIC | ✅ working (probe got 10 results) | OK for now |
| **indeed** (via JSearch) | Paid | RapidAPI JSearch | shares 200/month with jsearch | ❌ **QUOTA BURNT** | Set `DISABLED_SCRAPERS=…,indeed` or upgrade tier |
| **rozee** (via SerpAPI) | Paid | SerpAPI Google Jobs | 250 searches/month FREE | ❌ **QUOTA BURNT** | Set `DISABLED_SCRAPERS=…,rozee` or upgrade tier |
| **google** (via SerpAPI) | Paid | SerpAPI Google Jobs | shares 250/month with rozee | ❌ **QUOTA BURNT** | Set `DISABLED_SCRAPERS=…,google` or upgrade tier |

## What to set in Vercel env *right now*

```env
DISABLED_SCRAPERS=rozee,google,indeed
```

This stops the cron from making API calls to quota-burnt sources. Runs land
as `skipped` in ScraperRun (no failure accumulation, no circuit-breaker
thrash). Strip an entry the moment its upstream is back.

## What's on what plan

### SerpAPI (rozee + google share this key)
- Free: **250 searches/month**. Resets monthly.
- **$50/mo** = 5,000 searches. Catches up after ~3 days of normal cron load.
- **$130/mo** = 15,000 searches. Reasonable upper bound for the current setup.
- Cancel via dashboard, no commitment.

### RapidAPI / JSearch (indeed + jsearch share this key)
- BASIC (free): **200 reqs/month**. Resets monthly.
- PRO: **$10/mo** = 10,000 reqs/month. Single biggest leverage upgrade for the cost.
- ULTRA: **$25/mo** = 100,000 reqs/month. Probably overkill.

### Adzuna
- Free tier: **250 calls/day**. Reset daily, no monthly cap.
- No paid tier — you're already on the only tier they offer.

### LinkedIn / arbeitnow / remotive / linkedin_posts
- Free, no API key, no formal quota. Could be rate-limited or blocked at any
  time (LinkedIn especially) — when they break, no upgrade path; switch to
  a different free source.

## Practical posture

Given the current state:

- **Free sources alone** (arbeitnow + remotive + linkedin + linkedin_posts +
  adzuna-non-PK) produce **~1,800 jobs/day** on this codebase. That's plenty
  of pipeline for a small user base.
- The paid sources mostly matter for the Pakistan market (rozee + google
  cover the PK long tail that adzuna can't). If PK reach matters, **upgrade
  SerpAPI to the $50/mo tier** — that's the single highest-leverage move.
- The RapidAPI JSearch monthly is a slower bleed — only worth the $10/mo if
  you actually need Indeed-published jobs specifically.

## Operator levers (cheat sheet)

```env
# Nuclear: skip ALL paid sources at once (adzuna+google+rozee+jsearch+indeed)
SKIP_PAID_SOURCES=1

# Surgical: skip specific sources (comma list, case-insensitive)
DISABLED_SCRAPERS=rozee,google,indeed

# Adjust Adzuna's default country (when no city matches the map)
ADZUNA_COUNTRY=us
```

`SKIP_PAID_SOURCES=1` is the one-flip recovery move for "shared upstream
exploded" cases — burns the SerpAPI quota, hit a RapidAPI cap, etc.
`DISABLED_SCRAPERS` is the surgical version for when only some are out.
Both land scrapers as `skipped` (not `failed`), so the circuit breaker
stays clear.

Plus the admin route for unsticking a circuit breaker once quota is back:

```bash
curl -X POST https://your.app/api/admin/scrapers/reset-breaker \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session>" \
  -d '{"source": "rozee"}'
```
