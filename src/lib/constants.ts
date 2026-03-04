// Centralized constants — replace all magic numbers with imports from here.

export const LIMITS = {
  /** Max UserJobs returned per Kanban page load */
  JOBS_PER_PAGE: 200,
  /** Max applications returned per page */
  APPLICATIONS_PER_PAGE: 200,
  /** Max resumes returned per listing */
  RESUMES_PER_PAGE: 100,
  /** Max activities returned for a single job detail */
  ACTIVITIES_PER_JOB: 50,
  /** Max export rows for jobs */
  EXPORT_JOBS: 5000,
  /** Max export rows for applications */
  EXPORT_APPLICATIONS: 5000,
  /** Max export rows for resumes */
  EXPORT_RESUMES: 100,
  /** Ceiling for existingJobIds membership checks */
  EXISTING_JOB_IDS: 10_000,
  /** Max global jobs to match in a single cron run */
  MATCH_BATCH: 500,
  /** Max users processed per cron cycle */
  USERS_BATCH: 500,
  /** Max applications to send per cron run (queued) — kept low for 10s Vercel limit (~1.5s per send) */
  SEND_QUEUED_BATCH: 4,
  /** Max applications to send per cron run (scheduled) — kept low for 10s Vercel limit (~1.5s per send) */
  SEND_SCHEDULED_BATCH: 4,
  /** Max follow-up candidates per cron run */
  FOLLOW_UP_BATCH: 200,
  /** Max notification jobs per user digest */
  NOTIFICATION_JOBS: 20,
  /** Duplicate-check candidate window */
  DUPLICATE_CHECK_BATCH: 500,
  /** Max keywords a user can configure */
  MAX_KEYWORDS: 500,
  /** Min length per keyword */
  MIN_KEYWORD_LENGTH: 2,
  /** Max length per keyword */
  MAX_KEYWORD_LENGTH: 60,
  /** Max resume content length (chars) */
  MAX_RESUME_CONTENT: 500_000,
  /** Max system health log rows */
  SYSTEM_HEALTH_LOGS: 20,
  /** Max analytics query rows */
  ANALYTICS_MAX_ROWS: 5000,
  /** Max onboarding match rows */
  ONBOARDING_MATCH_BATCH: 2000,
  /** Manual scan cooldown (ms) */
  SCAN_COOLDOWN_MS: 5 * 60 * 1000,
} as const;

export const TIMEOUTS = {
  /** Max runtime before a cron should self-terminate (ms) */
  CRON_SOFT_LIMIT_MS: 8_000,
  /** SMTP connection timeout (ms) */
  SMTP_TIMEOUT_MS: 10_000,
  /** Groq API per-call timeout (ms) */
  AI_TIMEOUT_MS: 15_000,
  /** Resume parser timeout per method (ms) — generous for serverless cold starts */
  RESUME_PARSE_TIMEOUT_MS: 25_000,
  /** Careers page scrape timeout (ms) */
  CAREERS_SCRAPE_TIMEOUT_MS: 5_000,
  // INTER_SEND_DELAY_MS and INSTANT_APPLY_DELAY_MS removed —
  // per-user sendDelaySeconds from UserSettings is used instead
  /** Per-API-call timeout for scrapers (ms) — must be well under Vercel 10s limit */
  SCRAPER_API_TIMEOUT_MS: 6_000,
  /** Soft deadline for scrapers to wrap up (ms) — bail and return partial results */
  SCRAPER_DEADLINE_MS: 8_000,
} as const;

export const MATCHING = {
  /** Minimum match score to show on Kanban */
  SHOW_ON_KANBAN: 40,
  /** Minimum match score for auto-draft generation */
  AUTO_DRAFT: 55,
  /** Default minimum score for auto-apply */
  DEFAULT_AUTO_APPLY_SCORE: 75,
} as const;

export const STALE_DAYS: Record<string, number> = {
  linkedin: 7,
  indeed: 5,
  remotive: 7,
  arbeitnow: 7,
  adzuna: 7,
  rozee: 7,
  jsearch: 5,
  google: 7,
  linkedin_posts: 5,
  manual: 30,
  default: 7,
} as const;

export const BANNED_KEYWORDS = [
  "test",
  "asdf",
  "xxx",
  "aaa",
  "bbb",
  "temp",
  "todo",
  "null",
  "undefined",
  "admin",
  "password",
  "123",
] as const;

export const STUCK_SENDING_TIMEOUT_MS = 10 * 60 * 1000;

export const FOLLOW_UP = {
  /** Days after APPLIED before marking as GHOSTED */
  GHOSTED_AFTER_DAYS: 14,
  /** Days after APPLIED/last follow-up before sending follow-up */
  FOLLOW_UP_AFTER_DAYS: 7,
  /** Max number of follow-ups per application */
  MAX_FOLLOW_UPS: 2,
} as const;
