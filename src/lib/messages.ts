// ---------------------------------------------------------------------------
// Centralized user-facing messages
// Every error, success, info, warning, and validation string in one place.
// Grouped by domain so they're easy to find and update.
// ---------------------------------------------------------------------------

// ─── Generic / Shared ──────────────────────────────────────────────────────
export const GENERIC = {
  UNAUTHORIZED: "You need to sign in to do that.",
  NOT_AUTHENTICATED: "Sign in to continue.",
  AUTHENTICATION_REQUIRED: "Sign in to continue.",
  FORBIDDEN: "You don't have access to that.",
  NOT_FOUND: "We couldn't find that.",
  INTERNAL_ERROR: "Something went sideways on our end.",
  INTERNAL_SERVER_ERROR: "Something went sideways on our end. Try again.",
  INVALID_REQUEST: "That request didn't look right.",
  INVALID_INPUT: "Some of that input didn't look right.",
  INVALID_STATUS: "That status isn't valid.",
  INVALID_ACTION: "That action isn't valid.",
  INVALID_SIGNATURE: "That request didn't check out.",
  INVALID_FORM_DATA: "That form data doesn't look right.",
  UNKNOWN_ACTION: "We don't recognize that action.",
  UNKNOWN_ERROR: "Something went sideways.",
  NETWORK_ERROR: "Network hiccup — check your connection.",
  NETWORK_ERROR_RETRY: "Network hiccup. Try again in a moment.",
  SOMETHING_WENT_WRONG: "Something went sideways.",
  SOMETHING_WENT_WRONG_RETRY: "Something went sideways. Try again.",
  SOMETHING_WENT_WRONG_GENERIC: "Something went sideways. Try again.",
  CHECK_CONNECTION: "Network hiccup — check your connection and try again.",
  FAILED_GENERIC: "We couldn't do that. Try again.",
  FAILED_UPDATE: "We couldn't update that. Try again.",
  PROCESSING_FAILED: "We hit a snag processing that. Try again.",
} as const

// ─── Auth ───────────────────────────────────────────────────────────────────
export const AUTH = {
  USERNAME_PASSWORD_REQUIRED: "Username and password are required",
  ADMIN_CREDENTIALS_NOT_CONFIGURED: "Admin credentials not configured on server",
  INVALID_CREDENTIALS: "Invalid credentials",
  INVALID_REQUEST: "Invalid request",
} as const

// ─── Validation ────────────────────────────────────────────────────────────
export const VALIDATION = {
  MISSING_ID_OR_STATUS: "Missing id or status",
  MISSING_USER_JOB_ID: "Missing userJobId",
  USER_JOB_ID_REQUIRED: "userJobId required",
  URL_REQUIRED: "URL is required",
  INVALID_URL: "Please enter a valid URL",
  PASTE_URL_FIRST: "Paste a URL first",
  TITLE_COMPANY_REQUIRED: "Title and company are required",
  NAME_SUBJECT_BODY_REQUIRED: "Name, subject, and body are required",
  FEEDBACK_MIN_LENGTH: "Please write at least 5 characters",
  IMAGE_FIELD_REQUIRED: "Image file is required (field name: image)",
  NO_FILE_PROVIDED: "No file provided",
  INVALID_SUBSCRIPTION: "Invalid subscription: missing endpoint or keys",
} as const

// ─── Rate Limit ─────────────────────────────────────────────────────────────
export const RATE_LIMIT = {
  TOO_MANY_REQUESTS: "Too many requests.",
  TOO_MANY_REQUESTS_SLOW: "Too many requests. Please slow down.",
  TOO_MANY_REQUESTS_WAIT: "Too many requests. Please wait a moment.",
  TOO_MANY_LOGIN_ATTEMPTS: "Too many login attempts. Please try again in a minute.",
  PLEASE_WAIT: (seconds: number) => `Please wait ${seconds}s before scanning again.`,
} as const

// ─── Health ────────────────────────────────────────────────────────────────
export const HEALTH = {
  HEALTH_CHECK_FAILED: "The health check came back inconclusive.",
  FAILED_LOAD_STATUS: "We couldn't load status right now.",
  FAILED_FETCH_HEALTH: "We couldn't pull health data right now.",
  LOGIN_REQUIRED: "Sign in to see system health.",
  FAILED_LOAD_SYSTEM_HEALTH: "We couldn't load system health right now.",
  EXPORT_STARTED: "Export started — check your downloads.",
} as const

// ─── Admin ─────────────────────────────────────────────────────────────────
export const ADMIN = {
  FORBIDDEN: "You don't have access to this admin area.",
  ACTION_FAILED: "That action didn't go through. Try again.",
  DELETE_FAILED: "We couldn't delete that. Try again.",
  CLEANUP_FAILED: "Cleanup didn't finish. Try again.",
  TRIGGER_FAILED: (source: string) => `We couldn't trigger ${source}. Try again.`,
  BACKFILL_FAILED: "Backfill didn't finish. Try again.",
  UNKNOWN_ACTION_NAMED: (action: string) => `Unknown action: ${action}.`,
  UNKNOWN_SOURCE: (source: string) => `Unknown source: ${source}.`,
  APP_URL_NOT_CONFIGURED: "NEXT_PUBLIC_APP_URL isn't set on the server.",
  CRON_SECRET_NOT_CONFIGURED: "CRON_SECRET isn't set on the server.",
  DELETED_INACTIVE_JOBS: (count: number) =>
    `Deleted ${count} inactive job${count === 1 ? "" : "s"} with no user links.`,
  DEACTIVATED_STALE_JOBS: (count: number, days: number) =>
    `Deactivated ${count} job${count === 1 ? "" : "s"} not seen in ${days} days.`,
  DEACTIVATED_NO_EMAIL_JOBS: (count: number) =>
    `Deactivated ${count} old job${count === 1 ? "" : "s"} without emails.`,
  FAILED_LOAD_STATS: "We couldn't load admin stats. Refresh to try again.",
  FAILED_LOAD_USERS: "We couldn't load the users list. Refresh to try again.",
  FAILED_LOAD_DATA: "We couldn't load that data. Refresh to try again.",
  FAILED_LOAD_LOGS: "We couldn't load the logs. Refresh to try again.",
  FAILED_LOAD_FEEDBACK: "We couldn't load feedback. Refresh to try again.",
  FAILED_TRIGGER: "We couldn't trigger that. Try again.",
  FAILED_UPDATE: "We couldn't update that. Try again.",
  MARKED_AS: (status: string) => `Marked as ${status}.`,
  TRIGGER_SUCCESS: (source: string, detail: string) => `${source}: ${detail}`,
  SOURCES_TRIGGERED: (count: number) =>
    `${count} source${count === 1 ? "" : "s"} triggered.`,
  TRIGGERED: "triggered",
  TRIGGERED_SOURCE: (source: string) => `Triggered ${source}.`,
} as const

// ─── Applications ──────────────────────────────────────────────────────────
export const APPLICATIONS = {
  GENERATION_FAILED: "Generation failed",
  PIPELINE_FAILED: "Pipeline failed",
  JOB_NOT_FOUND: "Job not found",
  USER_PROFILE_NOT_FOUND: "User profile not found. Please complete your profile first.",
  APPLICATION_EMAIL_NOT_CONFIGURED:
    "Application email not configured. Please set it in Settings.",
  NO_APPLICATIONS_SELECTED: "No applications selected",
  NO_SENDABLE_APPLICATIONS: "No sendable applications found",
  PROFILE_NOT_READY: "Profile not ready for sending",
  ALREADY_SENT: "This one's already been sent.",
  NOT_READY_MISSING: (missing: string) =>
    `Not quite ready to send. Still need: ${missing}.`,
  FAILED_GET_STATS: "We couldn't pull stats right now. Try again.",
  FAILED_LOAD: "We couldn't load your applications. Refresh to try again.",
  FAILED_LOAD_COUNTS: "We couldn't load the counts. Refresh to try again.",
  SUBJECT_REQUIRED: "Subject is required",
  EMAIL_BODY_REQUIRED: "Email body is required",
  SUBJECT_REQUIRED_MARK_READY: "Subject is required before marking ready",
  EMAIL_BODY_REQUIRED_MARK_READY: "Email body is required before marking ready",
  RECIPIENT_REQUIRED_MARK_READY: "Recipient email is required before marking ready",
  // Client messages
  SENT_TO: (email: string) => `Sent to ${email}!`,
  MARKED_READY: "Marked as ready",
  MARKED_READY_COUNT: (count: number) => `${count} application(s) marked ready`,
  FAILED_MARK_READY: "We couldn't mark that ready. Try again.",
  MARKED_MANUAL: "Marked as manually applied",
  FAILED_MARK_MANUAL: "We couldn't mark that as sent manually. Try again.",
  DELETED: "Application deleted",
  DELETED_COUNT: (count: number) => `${count} application(s) deleted`,
  DELETED_FAILED_COUNT: (count: number) => `Deleted ${count} failed application(s)`,
  DELETED_UNDELIVERED_COUNT: (count: number) => `Deleted ${count} undelivered application(s)`,
  CANCELLED_DRAFTS_COUNT: (count: number) => `Cancelled ${count} draft(s)`,
  FAILED_DELETE: "We couldn't delete that. Try again.",
  QUEUED_RETRY: "Queued for retry.",
  RETRY_FAILED: "We couldn't retry that. Try again.",
  SELECT_DRAFTS_FIRST: "Select some drafts first.",
  SELECT_WITH_EMAILS_FIRST: "Select applications that already have recipient emails.",
  SELECT_APPLICATIONS_FIRST: "Select some applications first.",
  SENT_COUNT: (count: number) => `${count} application${count === 1 ? "" : "s"} sent.`,
  QUEUED_COUNT: (count: number) => `${count} queued — they'll go out on the next cycle.`,
  FAILED_SEND_COUNT: (count: number) => `${count} didn't make it through. We'll retry them automatically.`,
  BULK_SEND_FAILED: "We couldn't send the batch. Try again.",
  NO_SAVED_JOBS_VERIFIED: "Nothing to draft — no saved jobs have verified emails yet.",
  MARKED_APPLIED: "Marked as applied.",
  MARKED_APPLIED_SUCCESS: "Marked as applied.",
  MARKED_APPLIED_COMPANY: (company: string) => `Marked as applied — ${company}.`,
  FAILED_MARK_APPLIED: "We couldn't mark that applied. Try again.",
  MOVED_TO_STAGE: (stage: string) => `Moved to ${stage}.`,
  FAILED_UPDATE_STAGE: "We couldn't move that. Try again.",
  FAILED_UPDATE_STAGE_REVERTED: "We couldn't move that. Put it back.",
  JOB_DISMISSED: "Dismissed — it won't show up again.",
  FAILED_DISMISS: "We couldn't dismiss that. Try again.",
  NOTE_SAVED: "Note saved.",
  FAILED_SAVE_NOTE: "We couldn't save that note. Try again.",
  JOB_SAVED: "Saved to your board.",
} as const

// ─── Analytics ─────────────────────────────────────────────────────────────
export const ANALYTICS = {
  FETCH_FAILED: "We couldn't load your analytics. Refresh to try again.",
  LOAD_FAILED: "We couldn't load your analytics. Refresh to try again.",
} as const

// ─── Email ─────────────────────────────────────────────────────────────────
export const EMAIL = {
  SETTINGS_NOT_FOUND: "Settings not found",
  NOT_CONFIGURED: "Email not configured. Set up Gmail or Outlook in Settings first.",
  NOT_CONFIGURED_HINT: "Go to Settings → Email Provider and enter your credentials.",
  BREVO_SET_PROVIDER:
    "Email provider is set to Brevo. Switch to Gmail or Outlook to send a test.",
  BREVO_HINT: "Brevo uses the system email server and doesn't need testing.",
  NO_SENDER: "No sender email configured",
  HINT_DEFAULT: "Check your SMTP settings.",
  HINT_GMAIL_APP_PASSWORD:
    "Invalid password. For Gmail, use an App Password — not your regular Gmail password. Go to myaccount.google.com → Security → App Passwords.",
  HINT_GMAIL_APP_PASSWORD_SHORT:
    "Invalid password. For Gmail, use an App Password (not your regular password).",
  HINT_2FA_REQUIRED:
    "2-Step Verification is not enabled on your Google account. Enable it first, then create an App Password.",
  HINT_CANT_CONNECT: "Can't connect to mail server. Check host and port settings.",
  HINT_CONNECTION_TIMED_OUT:
    "Connection timed out. The mail server may be blocking this connection.",
  HINT_ECONNREFUSED: "Cannot connect to SMTP server. Check host and port.",
  TEST_SUBJECT: "JobPilot — Your Email is Working!",
  // Client
  TEST_SENT: "Test email sent, check your inbox",
  TEST_FAILED: "Failed to send test email",
} as const

// ─── Export ────────────────────────────────────────────────────────────────
export const EXPORT = {
  FAILED: "Export failed",
  FAILED_RETRY: "Export failed, please try again",
  DOWNLOADED: "Export downloaded",
} as const

// ─── Jobs ──────────────────────────────────────────────────────────────────
export const JOBS = {
  IMAGE_TYPE_INVALID: (type: string) =>
    `Unsupported image type: ${type}. Allowed types: jpeg, png, webp, gif`,
  IMAGE_TOO_LARGE: "Image must be 10 MB or smaller",
  EXTRACT_IMAGE_FAILED: "Failed to extract job description",
  EXTRACT_URL_FAILED: "Failed to extract job details from URL",
  GENERATE_CONTENT_FAILED: "Failed to generate content",
  AI_EMPTY_CONTENT: "AI returned empty content",
  ADD_KEYWORDS_FIRST: "Add keywords in settings first.",
  SCAN_FAILED: "Scan failed. Please try again.",
  // Client
  EXTRACTED_FIELDS: (count: number) => `Extracted ${count} fields from URL`,
  FAILED_FETCH_URL: "Failed to fetch URL, check the link and try again",
  JOB_ADDED: "Job added successfully",
  FAILED_ADD_JOB: "Failed to add job",
  COVER_LETTER_GENERATED: "Cover letter & pitch generated",
  COVER_LETTER_GENERATED_SINGLE: "Cover letter generated",
  GENERATE_FAILED_RETRY: "Failed to generate — try again",
  FAILED_COPY: "Failed to copy",
  FAILED_COPY_MANUAL: "Failed to copy — try selecting and copying manually",
  DETAILS_COPIED: "Details copied to clipboard",
  DRAFT_READY: (name: string) => `Draft ready, resume: ${name}`,
  NEW_VERSION_GENERATED: "New version generated",
  REGENERATION_FAILED: "Regeneration failed, please try again",
  SEARCH_REQUEST_FAILED: "Search request failed.",
} as const

// ─── Onboarding ────────────────────────────────────────────────────────────
export const ONBOARDING = {
  MATCHING_ERROR: "Matching encountered an error",
  UPLOAD_FAILED: "Upload failed",
  RESUME_UPLOADED: (count: number) => `Resume uploaded! Detected ${count} skills.`,
  PROFILE_CONFIGURED: "Profile configured! Jobs will start appearing soon.",
  FAILED_SAVE: "Failed to save. Try again.",
} as const

// ─── Push Notifications ────────────────────────────────────────────────────
export const PUSH = {
  NOT_CONFIGURED: "Push notifications not configured",
  FAILED_SAVE_SUBSCRIPTION: "Failed to save subscription",
  FAILED_REMOVE_SUBSCRIPTION: "Failed to remove subscription",
} as const

// ─── Resumes ───────────────────────────────────────────────────────────────
export const RESUMES = {
  NOT_FOUND: "Resume not found",
  FILE_UNAVAILABLE: "File unavailable",
  PREVIEW_FAILED: "Preview failed",
  STORAGE_LIMIT: "You've hit your storage limit (20 MB). Delete one to make room.",
  MAX_ALLOWED: (max: number) => `You can have up to ${max} resumes saved. Delete one to add another.`,
  FILE_TOO_LARGE: "Files need to be under 5 MB.",
  PDF_ONLY: "Only PDFs work here. Export yours as PDF and try again.",
  UPLOAD_FAILED_RETRY: "Couldn't upload that. Give it another try.",
  // Client
  UPLOAD_FAILED: "Couldn't upload that",
  UPLOADED_WITH_SKILLS: (count: number) => `Saved. We picked up ${count} skill${count === 1 ? "" : "s"} from it.`,
  ADDED: "Resume added",
  FAILED_CREATE: "Couldn't save that resume",
  UPDATED: "Resume updated",
  FAILED_UPDATE: "Couldn't update that resume",
  FAILED_SAVE_CONTENT: "Couldn't save the content",
  DELETED: "Resume deleted",
  FAILED_DELETE: "Couldn't delete that resume",
  CATEGORIES_UPDATED: "Categories updated",
  FAILED_UPDATE_CATEGORIES: "Couldn't update categories",
  DEFAULT_UPDATED: "Default resume updated",
  FAILED_SET_DEFAULT: "Couldn't set that as default",
  REEXTRACTION_FAILED: "Couldn't re-read that resume",
  EXTRACTING_FIRST: "Reading the PDF first…",
  NO_CONTENT_REPHRASE:
    "Nothing to rephrase yet — paste your resume text first.",
  REPHRASE_FAILED: "Rephrase didn't work — try again",
} as const

// ─── Resume Upload (per-stage error codes) ─────────────────────────────────
// User-facing strings only — calm + plain. Stage codes live in the route
// for grepping prod logs; users never see them.
export const RESUME_UPLOAD = {
  BLOB_TOKEN_MISSING: "Uploads aren't available right now. Try again in a bit.",
  BLOB_PUT_FAILED: "Couldn't save your file. Give it another try.",
  BAD_FORM_DATA: "We couldn't read that file. Try a smaller one, or check your connection.",
  DB_WRITE_FAILED: "Almost there — your file saved but we couldn't finish recording it. Try again.",
} as const

// ─── Resume Tailoring (Generate route + Coverage panel) ────────────────────
// Every user-visible string from the tailor flow lives here. Keep them
// calm + plain — no "audit", "fabrication", "force-include", "page-target"
// or other mechanism words. Users only need to know what happened and
// what they can do next.
export const RESUME_TAILORING = {
  // Generate route — preflight errors
  NO_PROFILE_OR_UPLOADS:
    "You need a resume on file first. Upload one, or build your profile, then come back.",
  PARSE_INCOMPLETE: (resumeName: string) =>
    `We couldn't read enough from "${resumeName}". Try another resume, or fill in the editor by hand.`,
  PARSE_FAILED: "We couldn't read that resume. Try another one.",
  NO_PARSEABLE_UPLOADS:
    "None of your uploaded resumes have readable text yet. Open the Uploads tab and tap Re-parse PDF on one, then come back.",
  ALL_UPLOADS_FAILED: (count: number) =>
    `We tried ${count} of your uploaded resumes but couldn't pull a full profile from any. Build your profile manually under My Profile to keep going.`,
  USED_UPLOADED_PROFILE: (resumeName: string) =>
    `Used "${resumeName}" for this one. Save a profile under Resumes for faster runs next time.`,
  TRIED_MULTIPLE_UPLOADS: (resumeName: string, attempts: number) =>
    `Used "${resumeName}" — your first ${attempts - 1} upload${attempts - 1 === 1 ? "" : "s"} didn't have enough structure. Build a profile under My Profile to skip this next time.`,

  // Generate route — render-time errors
  RENDER_FALLBACK_GENERIC:
    "We couldn't finish rendering that resume. Try again, or switch templates.",
  AUDIT_BLOCKED:
    "The AI tried to put skills or experience on your PDF that aren't in your profile. We blocked it so your resume stays honest. Add the missing items under My Profile if they're true, or use a JD that better matches your actual experience.",

  // Generate route — agent chain warnings
  AGENT_CHAIN_FALLBACK:
    "Tailoring step ran into a hiccup — used your default ordering instead.",
  KEYWORDS_KEPT: (projects: number, skills: number, keywords: string[]) => {
    const parts: string[] = [];
    if (projects > 0) parts.push(`${projects} project${projects === 1 ? "" : "s"}`);
    if (skills > 0) parts.push(`${skills} skill${skills === 1 ? "" : "s"}`);
    const subject = parts.join(" and ");
    const kw = keywords.slice(0, 5).join(", ");
    return `Kept ${subject} on the PDF${kw ? ` so ${kw} would show up` : ""}.`;
  },
  KEYWORDS_LOST_TO_PAGE: (count: number, keywords: string[]) =>
    `${count} keyword${count === 1 ? "" : "s"} didn't fit on one page (${keywords.slice(0, 5).join(", ")}${keywords.length > 5 ? "…" : ""}). Try 2 pages to keep them.`,
  KEYWORDS_NOT_RENDERED: (count: number, keywords: string[]) =>
    `${count} keyword${count === 1 ? "" : "s"} didn't render on the PDF (${keywords.slice(0, 5).join(", ")}${keywords.length > 5 ? "…" : ""}). Try a different template or 2 pages.`,
  MISSING_FROM_PROFILE: (count: number, keywords: string[]) =>
    `${count} keyword${count === 1 ? "" : "s"} the job asked for aren't in your profile (${keywords.slice(0, 5).join(", ")}${keywords.length > 5 ? "…" : ""}). Add them under Resumes if they're true.`,

  // Coverage panel — labels (UI)
  COVERAGE_TITLE: "ATS keyword coverage",
  COVERAGE_KEPT_SUMMARY: (count: number) =>
    `We kept ${count} extra item${count === 1 ? "" : "s"} on your PDF so the keywords you actually have show up.`,
  COVERAGE_LIST_VERIFIED: "On your PDF (verified)",
  COVERAGE_LIST_BASIC: "On your PDF",
  COVERAGE_LIST_KEPT: "Kept on the PDF (you had these, the AI initially skipped them)",
  COVERAGE_LOST_HEADLINE: "Some keywords didn't make it on the page",
  COVERAGE_LOST_HINT_BASIC: "Too much for one page.",
  COVERAGE_LOST_HINT_BUMP: "Switch to 2 pages above to keep all of them.",
  COVERAGE_AUDIT_HEADLINE: "These didn't render on the PDF",
  COVERAGE_AUDIT_HINT:
    "Probably hidden by the template at this size. Try a different template or use 2 pages.",
  COVERAGE_DETAILS_SHOW: "Show more detail",
  COVERAGE_DETAILS_HIDE: "Show less",

  // Missing keywords block (tailor coverage panel)
  MISSING_WITH_ADJACENCY_HEADLINE: (count: number) =>
    `The job mentioned these, but you have related experience (${count})`,
  MISSING_ADJACENCY_PROMPT: (jobKw: string) => `Job wants ${jobKw} — you have:`,
  MISSING_ADJACENCY_HINT:
    "Worth a quick mention if it's honestly relevant.",
  MISSING_PROJECT_TAG: (count: number) =>
    `+ ${count} project${count === 1 ? "" : "s"} with related work`,
  MISSING_COLD_HEADLINE: "The job asked for these, you don't have them yet",
  MISSING_COLD_NEW_HEADLINE: "Missing from your profile",
  MISSING_COLD_HINT:
    "We won't make these up. Add them under Resumes if they're true, or skip this job if the gap is too wide.",

  // /resumes/tailor page hints
  TAILOR_HEADER_TITLE: "Tailor your resume for this job",
  TAILOR_HEADER_BODY:
    "Paste the JD, pick a template, get an ATS-matched PDF using your own profile content. Every word traces back to you, no fabrication.",
  TAILOR_AI_EXTRACT_HEADS_UP: (resumeName: string) =>
    `Heads up: we read your profile from "${resumeName}". For faster runs next time, save your structured profile.`,
} as const

// ─── Application-email action errors ───────────────────────────────────────
// These surface in toasts when Tailor & Apply or Generate Email fail. Old
// copy threw raw mechanism words ("contact support", "Complete your profile
// in Settings first") — replaced with friendlier strings that name the page
// to go to.
export const APPLICATION_EMAIL_ERR = {
  NO_SETTINGS: "Set up your profile first — head to Settings.",
  PROFILE_DECRYPT_FAIL: "Couldn't read your saved profile. Open Settings and save again to fix it.",
  PROFILE_INCOMPLETE: "Your profile is missing some basics. Pop into Settings and fill in your name and email.",
  NO_RESUMES_UPLOADED: "Upload a resume first — under Resumes.",
  SELECTED_RESUME_NOT_FOUND: "We couldn't find that resume. Pick a different one.",
  JOB_NOT_FOUND: "We couldn't find that job — it may have been removed.",
  APPLICATION_NOT_FOUND: "That application draft isn't around any more.",
  INVALID_EMAIL: "That email address doesn't look right.",
} as const

// ─── JD quick-start card on /resumes ───────────────────────────────────────
export const TAILOR_CARD = {
  HEADLINE: "Tailor for a specific job",
  BODY:
    "Paste the JD here, pick a template, get an ATS-matched PDF. Every word traces back to you, no fabrication.",
  HINT_STRUCTURED:
    "Uses your saved profile. Keeps the keywords you have, flags the ones you don't.",
  HINT_AI_EXTRACT:
    "We'll read your best uploaded resume on the fly. Save a profile for faster runs next time.",
  HINT_NEEDS_SETUP:
    "You need a resume on file before tailoring. We'll set that up first.",
  CHIP_STRUCTURED: "Ready to tailor",
  CHIP_AI_EXTRACT: "Using your upload",
  CHIP_NEEDS_SETUP: "Setup needed",
  BUTTON_STRUCTURED: "Tailor for this JD",
  BUTTON_AI_EXTRACT: "Tailor using my upload",
  BUTTON_NEEDS_SETUP: "Set up first",
  NEED_MORE_CHARS: (n: number) => `A bit more (${n} chars to go)`,
} as const

// ─── Job pipeline (banners + status) ───────────────────────────────────────
export const PIPELINE = {
  // Pipeline-dead banner
  DEAD_HEADLINE: "New jobs are paused for now",
  DEAD_BODY_NEVER_RAN: "Automatic refresh hasn't started yet.",
  DEAD_BODY_AGE: (hours: number) => `Last fresh batch arrived ${hours}h ago.`,
  DEAD_BODY_CTA: "Tap Scan now for an instant refresh.",
  // Per-source banner
  PARTIAL_HEADLINE_ONE: "One source is quiet right now",
  PARTIAL_HEADLINE_MANY: (count: number) => `${count} sources are quiet right now`,
  PARTIAL_BODY: "Your list might be a bit shorter than usual. The rest are still feeding jobs in.",
} as const

// ─── Settings ──────────────────────────────────────────────────────────────
export const SETTINGS = {
  FAILED_LOAD_MODE: "Failed to load mode",
  FAILED_UPDATE: "Failed to update",
  // Client
  SAVED: "Settings saved successfully",
  FAILED_SAVE: "Failed to save settings",
  FAILED_UPDATE_STATUS: "Failed to update status",
  ACCOUNT_DELETED: "Account deleted",
} as const

// ─── Templates ─────────────────────────────────────────────────────────────
export const TEMPLATES = {
  UPDATED: "Template updated",
  FAILED_UPDATE: "We couldn't save those changes. Try again.",
  DEFAULT_UPDATED: "Default template updated",
  FAILED_SET_DEFAULT: "We couldn't set that as default. Try again.",
  DELETED: "Template deleted",
  FAILED_DELETE: "We couldn't delete that template. Try again.",
  CREATED: "Template created",
  FAILED_CREATE: "We couldn't save that template. Try again.",
} as const

// ─── Dashboard / Bulk + Next-best-action greeting ──────────────────────────
export const DASHBOARD = {
  // Bulk-action toasts
  CLEARED_OLD_JOBS: (count: number) => `Cleared ${count} old jobs`,
  CLEARED_JOBS: (count: number) => `Cleared ${count} jobs`,
  DELETED_APPS_STATUS: (count: number, status: string) =>
    `Deleted ${count} ${status} applications`,
  CANCELLED_DRAFTS: (count: number) => `Cancelled ${count} drafts`,
  ALL_DATA_CLEARED: "All data cleared — fresh start!",
  // Next-best-action card (when no queue + no delivery stats yet)
  NEXT_ACTION_TITLE: "Nothing in motion yet",
  NEXT_ACTION_BODY:
    "Auto-search keeps running in the background. Meanwhile, you can browse what's already matched, paste a JD to tailor a resume, or upload a PDF if you haven't yet.",
  NEXT_ACTION_PRIMARY: "Find jobs",
  NEXT_ACTION_TAILOR: "Tailor for a JD",
  NEXT_ACTION_SETUP: "Or set up your profile first →",
} as const

// ─── Settings page (keywords leverage callout) ─────────────────────────────
export const SETTINGS_COPY = {
  KEYWORDS_LEVERAGE_TITLE: "⚡ Highest-impact setting",
  KEYWORDS_LEVERAGE_BODY:
    "The keywords below decide what jobs come in and how well each one matches. Get these right and the queue lights up within an hour.",
  KEYWORDS_LEVERAGE_ZERO: "You haven't added any keywords yet — nothing will match.",
  KEYWORDS_LEVERAGE_FEW: (count: number) =>
    `You have ${count} keyword${count === 1 ? "" : "s"} — add a few more for broader matches.`,
} as const

// ─── Onboarding wizard (keyword step prompt) ───────────────────────────────
export const ONBOARDING_COPY = {
  KEYWORDS_STEP_TITLE: "Tell us what you want to be found for",
  KEYWORDS_STEP_BODY:
    "These keywords decide both what jobs we pull and how each one scores. Aim for 5–15 specific terms — skills, frameworks, or job titles.",
  KEYWORDS_INPUT_LABEL: "Skills or job titles",
  KEYWORDS_INPUT_HINT: "(type and press Enter, or pick presets below)",
  KEYWORDS_INPUT_PLACEHOLDER: "e.g. React, TypeScript, Next.js, Frontend Engineer…",
  KEYWORDS_ZERO_WARN: "No keywords yet — your job queue will be empty until you add some.",
  KEYWORDS_COUNT_HINT: (n: number) => `${n} · aim for 5–15`,
} as const

// ─── /resumes/gaps page (strategic missing-keywords view) ──────────────────
export const GAPS_COPY = {
  PAGE_TITLE: "Keyword gaps",
  PAGE_DESCRIPTION:
    "Across the jobs you've been looking at, here's what your profile is missing the most — fix the top one and you unlock a chunk at once.",
  STATS_JOBS: "Jobs we looked at",
  STATS_AVG_COVERAGE: "Avg ATS match",
  STATS_DISTINCT: "Things missing",
  TOP_LEVERAGE_PREFIX: "Most-blocking gap right now:",
  TOP_LEVERAGE_BODY: (jobs: number, total: number, pct: number) =>
    `Honestly adding this would unlock ${jobs} of your ${total} jobs (${pct}%).`,
  TOP_LEVERAGE_HAS_RELATED: "You already have related experience — check the row below.",
  LIST_HEADER: "Top missing keywords · ranked by how many jobs they block",
  FOOTER: (jobCount: number) =>
    `Pulled from your last ${jobCount} active jobs (saved, recommended, applied). Updates as your list does.`,
  CHIP_RELATED: "you have something close",
  CHIP_COLD: "new to you",
  ROW_RELATED_HEADLINE: "You have related experience — worth mentioning if it's honest:",
  ROW_PROJECT_TAG: (count: number) =>
    `+ ${count} project${count === 1 ? "" : "s"}`,
  ROW_COLD_BODY: (jobs: number) =>
    `Brand new to you. A weekend project (one repo, one demo) unlocks ${jobs} job${jobs === 1 ? "" : "s"}.`,
  ROW_SAMPLE_LABEL: "Jobs asking for this",
  EMPTY_NOTHING_BLOCKED_HEADLINE: "Nothing's blocking you",
  EMPTY_NOTHING_BLOCKED_BODY:
    "Your profile covers every keyword we saw. Save more jobs to find new gaps.",
} as const

// ─── /resumes/outcomes page ─────────────────────────────────────────────────
export const OUTCOMES_COPY = {
  PAGE_TITLE: "What's working",
  PAGE_DESCRIPTION:
    "Callback rate by template and ATS match, across what you've actually sent. Lean into what converts.",
  STAT_TOTAL: "Total sent",
  STAT_CALLBACKS: "Callbacks",
  STAT_REJECTED: "Rejected / ghosted",
  STAT_RATE: "Callback rate",
  NOT_ENOUGH_DATA:
    "Not enough callbacks yet to call winners. Send 3+ applications with at least one positive reply and patterns start showing up.",
  WINNING_TEMPLATE_LABEL: "Winning template",
  WINNING_TEMPLATE_DETAIL: (positive: number, decisive: number, ratePct: number) =>
    `${positive} out of ${decisive} got callbacks (${ratePct}%). Lean on this for similar roles.`,
  WINNING_COVERAGE_LABEL: "Winning coverage level",
  WINNING_COVERAGE_DETAIL: (ratePct: number) =>
    `Applications at this coverage got callbacks ${ratePct}% of the time. Skip jobs below this if you can.`,
  TABLE_BY_TEMPLATE: "By template",
  TABLE_BY_COVERAGE: "By ATS coverage",
  TABLE_COL_LABEL: "Label",
  TABLE_COL_SENT: "Sent",
  TABLE_COL_CALLBACK: "Callbacks",
  TABLE_COL_NO: "No",
  TABLE_COL_RATE: "Rate",
} as const

// ─── Skill suggestions panel (Profile editor) ──────────────────────────────
export const SKILL_SUGGESTIONS_COPY = {
  PANEL_TITLE: "Top-impact skills from your saved jobs",
  PANEL_BODY:
    "Adding these would unlock the most jobs in your list. Only add what's honestly true — we won't make things up.",
  LOADING: "Looking at your saved jobs for the highest-impact skills…",
  CHIP_RELATED: "you have related work",
  PLUS_JOBS: (n: number) => `+${n} jobs`,
  REASON_RELATED: (jobs: number) =>
    `Unlocks ${jobs} job${jobs === 1 ? "" : "s"} — you already have related experience.`,
  REASON_COLD: (jobs: number) =>
    `Unlocks ${jobs} job${jobs === 1 ? "" : "s"}. Only add if you can claim it honestly.`,
} as const

// ─── Feedback ──────────────────────────────────────────────────────────────
export const FEEDBACK = {
  MIN_LENGTH: "Please write at least 5 characters",
  FAILED: "Something went wrong",
} as const

// ─── Webhooks ──────────────────────────────────────────────────────────────
export const WEBHOOKS = {
  INVALID_SIGNATURE: "Invalid signature",
  PROCESSING_FAILED: "Processing failed",
  BOUNCE_REASON_DEFAULT: (eventType: string) => `Bounce received (${eventType})`,
} as const

// ─── Cron ──────────────────────────────────────────────────────────────────
export const CRON = {
  UNAUTHORIZED: "Unauthorized",
} as const

// ─── Scraper ───────────────────────────────────────────────────────────────
export const SCRAPER = {
  TRIGGER_FAILED: (source: string) => `Trigger failed for ${source}`,
} as const
