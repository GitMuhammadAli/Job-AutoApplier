// ---------------------------------------------------------------------------
// Centralized user-facing messages
// Every error, success, info, warning, and validation string in one place.
// Grouped by domain so they're easy to find and update.
// ---------------------------------------------------------------------------

// ─── Generic / Shared ──────────────────────────────────────────────────────
export const GENERIC = {
  UNAUTHORIZED: "Unauthorized",
  NOT_AUTHENTICATED: "Not authenticated",
  AUTHENTICATION_REQUIRED: "Authentication required",
  FORBIDDEN: "Forbidden",
  NOT_FOUND: "Not found",
  INTERNAL_ERROR: "Internal error",
  INTERNAL_SERVER_ERROR: "Internal server error",
  INVALID_REQUEST: "Invalid request",
  INVALID_INPUT: "Invalid input",
  INVALID_STATUS: "Invalid status",
  INVALID_ACTION: "Invalid action",
  INVALID_SIGNATURE: "Invalid signature",
  INVALID_FORM_DATA: "Invalid form data",
  UNKNOWN_ACTION: "Unknown action",
  UNKNOWN_ERROR: "Unknown error",
  NETWORK_ERROR: "Network error",
  NETWORK_ERROR_RETRY: "Network error, please try again",
  SOMETHING_WENT_WRONG: "Something went wrong",
  SOMETHING_WENT_WRONG_RETRY: "Something went wrong, please try again",
  SOMETHING_WENT_WRONG_GENERIC: "Something went wrong. Please try again.",
  CHECK_CONNECTION: "Network error — check your connection",
  FAILED_GENERIC: "Failed",
  FAILED_UPDATE: "Failed to update",
  PROCESSING_FAILED: "Processing failed",
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
  HEALTH_CHECK_FAILED: "Health check failed",
  FAILED_LOAD_STATUS: "Failed to load status",
  FAILED_FETCH_HEALTH: "Failed to fetch health",
  LOGIN_REQUIRED: "Please log in to view system health",
  FAILED_LOAD_SYSTEM_HEALTH: "Failed to load system health",
  EXPORT_STARTED: "Export started",
} as const

// ─── Admin ─────────────────────────────────────────────────────────────────
export const ADMIN = {
  FORBIDDEN: "Forbidden",
  ACTION_FAILED: "Action failed",
  DELETE_FAILED: "Delete failed",
  CLEANUP_FAILED: "Cleanup failed",
  TRIGGER_FAILED: (source: string) => `Trigger failed for ${source}`,
  BACKFILL_FAILED: "Backfill failed",
  UNKNOWN_ACTION_NAMED: (action: string) => `Unknown action: ${action}`,
  UNKNOWN_SOURCE: (source: string) => `Unknown source: ${source}`,
  APP_URL_NOT_CONFIGURED: "NEXT_PUBLIC_APP_URL not configured",
  CRON_SECRET_NOT_CONFIGURED: "CRON_SECRET not configured",
  DELETED_INACTIVE_JOBS: (count: number) => `Deleted ${count} inactive jobs with no user links`,
  DEACTIVATED_STALE_JOBS: (count: number, days: number) =>
    `Deactivated ${count} jobs not seen in ${days} days`,
  DEACTIVATED_NO_EMAIL_JOBS: (count: number) => `Deactivated ${count} old jobs without emails`,
  FAILED_LOAD_STATS: "Failed to load admin stats",
  FAILED_LOAD_USERS: "Failed to load users",
  FAILED_LOAD_DATA: "Failed to load data",
  FAILED_LOAD_LOGS: "Failed to load logs",
  FAILED_LOAD_FEEDBACK: "Failed to load feedback",
  FAILED_TRIGGER: "Failed to trigger",
  FAILED_UPDATE: "Failed to update",
  MARKED_AS: (status: string) => `Marked as ${status}`,
  TRIGGER_SUCCESS: (source: string, detail: string) => `${source}: ${detail}`,
  SOURCES_TRIGGERED: (count: number) => `${count} sources triggered`,
  TRIGGERED: "triggered",
  TRIGGERED_SOURCE: (source: string) => `Triggered ${source}`,
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
  ALREADY_SENT: "Already sent",
  NOT_READY_MISSING: (missing: string) => `Not ready to send. Missing: ${missing}`,
  FAILED_GET_STATS: "Failed to get stats",
  FAILED_LOAD: "Failed to load applications",
  FAILED_LOAD_COUNTS: "Failed to load application counts",
  SUBJECT_REQUIRED: "Subject is required",
  EMAIL_BODY_REQUIRED: "Email body is required",
  SUBJECT_REQUIRED_MARK_READY: "Subject is required before marking ready",
  EMAIL_BODY_REQUIRED_MARK_READY: "Email body is required before marking ready",
  RECIPIENT_REQUIRED_MARK_READY: "Recipient email is required before marking ready",
  // Client messages
  SENT_TO: (email: string) => `Sent to ${email}!`,
  MARKED_READY: "Marked as ready",
  MARKED_READY_COUNT: (count: number) => `${count} application(s) marked ready`,
  FAILED_MARK_READY: "Failed to mark ready",
  MARKED_MANUAL: "Marked as manually applied",
  FAILED_MARK_MANUAL: "Failed to mark manual",
  DELETED: "Application deleted",
  DELETED_COUNT: (count: number) => `${count} application(s) deleted`,
  DELETED_FAILED_COUNT: (count: number) => `Deleted ${count} failed application(s)`,
  DELETED_UNDELIVERED_COUNT: (count: number) => `Deleted ${count} undelivered application(s)`,
  CANCELLED_DRAFTS_COUNT: (count: number) => `Cancelled ${count} draft(s)`,
  FAILED_DELETE: "Failed to delete",
  QUEUED_RETRY: "Queued for retry",
  RETRY_FAILED: "Retry failed",
  SELECT_DRAFTS_FIRST: "Select draft applications first",
  SELECT_WITH_EMAILS_FIRST: "Select applications with recipient emails first",
  SELECT_APPLICATIONS_FIRST: "Select applications first",
  SENT_COUNT: (count: number) => `${count} application(s) sent!`,
  QUEUED_COUNT: (count: number) => `${count} queued — will be sent by the next cron cycle`,
  FAILED_SEND_COUNT: (count: number) => `${count} failed to send`,
  BULK_SEND_FAILED: "Bulk send failed",
  NO_SAVED_JOBS_VERIFIED: "No saved jobs with verified emails to draft",
  MARKED_APPLIED: "Marked as applied",
  MARKED_APPLIED_SUCCESS: "Marked as applied!",
  MARKED_APPLIED_COMPANY: (company: string) => `Marked as applied — ${company}`,
  FAILED_MARK_APPLIED: "Failed to mark as applied",
  MOVED_TO_STAGE: (stage: string) => `Moved to ${stage}`,
  FAILED_UPDATE_STAGE: "Failed to update stage",
  FAILED_UPDATE_STAGE_REVERTED: "Failed to update stage. Reverted.",
  JOB_DISMISSED: "Job dismissed",
  FAILED_DISMISS: "Failed to dismiss job",
  NOTE_SAVED: "Note saved",
  FAILED_SAVE_NOTE: "Failed to save note",
  JOB_SAVED: "Job saved to your board",
} as const

// ─── Analytics ─────────────────────────────────────────────────────────────
export const ANALYTICS = {
  FETCH_FAILED: "Failed to fetch analytics",
  LOAD_FAILED: "Failed to load analytics",
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
  STORAGE_LIMIT: "Storage limit reached (20 MB). Delete a resume first.",
  MAX_ALLOWED: (max: number) => `Maximum ${max} resumes allowed. Delete one first.`,
  FILE_TOO_LARGE: "File must be under 5 MB",
  PDF_ONLY: "Only PDF files are supported. Please convert your resume to PDF first.",
  UPLOAD_FAILED_RETRY: "Upload failed. Please try again.",
  // Client
  UPLOAD_FAILED: "Upload failed",
  UPLOADED_WITH_SKILLS: (count: number) => `Resume uploaded! Extracted ${count} skills.`,
  ADDED: "Resume added",
  FAILED_CREATE: "Failed to create resume",
  UPDATED: "Resume updated",
  FAILED_UPDATE: "Failed to update resume",
  FAILED_SAVE_CONTENT: "Failed to save content",
  DELETED: "Resume deleted",
  FAILED_DELETE: "Failed to delete resume",
  CATEGORIES_UPDATED: "Categories updated",
  FAILED_UPDATE_CATEGORIES: "Failed to update categories",
  DEFAULT_UPDATED: "Default resume updated",
  FAILED_SET_DEFAULT: "Failed to set default resume",
  REEXTRACTION_FAILED: "Re-extraction failed",
  EXTRACTING_FIRST: "Extracting text from PDF first...",
  NO_CONTENT_REPHRASE:
    "No content to rephrase. Paste your resume text first.",
  REPHRASE_FAILED: "Rephrase failed",
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
  FAILED_UPDATE: "Failed to update template",
  DEFAULT_UPDATED: "Default template updated",
  FAILED_SET_DEFAULT: "Failed to set default",
  DELETED: "Template deleted",
  FAILED_DELETE: "Failed to delete template",
  CREATED: "Template created",
  FAILED_CREATE: "Failed to create template",
} as const

// ─── Dashboard / Bulk ──────────────────────────────────────────────────────
export const DASHBOARD = {
  CLEARED_OLD_JOBS: (count: number) => `Cleared ${count} old jobs`,
  CLEARED_JOBS: (count: number) => `Cleared ${count} jobs`,
  DELETED_APPS_STATUS: (count: number, status: string) =>
    `Deleted ${count} ${status} applications`,
  CANCELLED_DRAFTS: (count: number) => `Cancelled ${count} drafts`,
  ALL_DATA_CLEARED: "All data cleared — fresh start!",
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
