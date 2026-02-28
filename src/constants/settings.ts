export const APPLICATION_MODES = [
  {
    value: "manual" as const,
    schemaValue: "MANUAL" as const,
    label: "Manual",
    icon: "Hand",
    badge: null,
    shortDesc: "Copy & Apply Yourself",
    description:
      "AI prepares everything. You copy and apply through Gmail, LinkedIn, or any platform.",
    steps: [
      "JobPilot searches 8 job sites",
      "AI scores and matches jobs",
      "AI writes email + cover letter",
      "AI picks best resume",
      "You copy and paste into your email",
      "Click \u2018I Applied\u2019 when done",
    ],
    bestFor: "You review and send every application yourself.",
    riskLevel: "none" as const,
    riskLabel: "Zero risk",
    requires: [] as string[],
  },
  {
    value: "semi_auto" as const,
    schemaValue: "SEMI_AUTO" as const,
    label: "Semi-Auto",
    icon: "Sparkles",
    badge: "DEFAULT",
    shortDesc: "Review & Send",
    description:
      "AI prepares everything. You review, edit if needed, then click Send.",
    steps: [
      "JobPilot searches 8 job sites",
      "AI scores and matches jobs",
      "AI writes email + cover letter",
      "AI picks best resume",
      "You review the draft \u2014 edit anything",
      "Click \u2018Send\u2019 \u2192 sent from your email with resume attached",
    ],
    bestFor: "We prepare drafts, you review and click send.",
    riskLevel: "low" as const,
    riskLabel: "Low risk",
    requires: ["emailProvider", "resume"],
  },
  {
    value: "full_auto" as const,
    schemaValue: "FULL_AUTO" as const,
    label: "Full Auto",
    icon: "Bot",
    badge: null,
    shortDesc: "Auto-Send High Matches",
    description:
      "High-scoring jobs auto-applied. Lower matches saved as drafts for review.",
    steps: [
      "JobPilot searches every 30 minutes",
      "New job \u2192 AI scores against your profile",
      "Score above threshold \u2192 AI writes + sends automatically",
      "Configurable delay before sending (you can catch & edit)",
      "You get notification: \u2018Applied to TechCorp\u2019",
    ],
    bestFor:
      "We send applications automatically for high-scoring matches.",
    riskLevel: "high" as const,
    riskLabel: "Higher risk",
    requires: [
      "emailProvider",
      "resume",
      "fullName",
      "keywords",
      "categories",
      "nonBrevoEmail",
    ],
  },
  {
    value: "instant" as const,
    schemaValue: "FULL_AUTO" as const,
    label: "Instant",
    icon: "Zap",
    badge: "ADVANCED",
    shortDesc: "Maximum Speed \u2014 No Review",
    description:
      "Apply within minutes of a job posting. No drafts, no delay.",
    steps: [
      "Job posted at 10:32 AM",
      "Found at 10:45 AM (15-min scrape)",
      "AI scores: 91% \u2192 above threshold",
      "AI picks resume + writes email in 2 seconds",
      "SENT at 10:47 AM \u2014 you\u2019re applicant #2",
    ],
    bestFor:
      "We send immediately when a matching job appears — maximum speed.",
    riskLevel: "high" as const,
    riskLabel: "Medium risk",
    requires: [
      "emailProvider",
      "resume",
      "fullName",
      "keywords",
      "categories",
      "nonBrevoEmail",
      "customPrompt",
      "resumeCategories",
      "testEmailSent",
    ],
    warning:
      "Sends real emails without review. Start with Semi-Auto first to verify AI quality.",
  },
] as const;

export type ApplicationModeValue =
  (typeof APPLICATION_MODES)[number]["value"];

export const EMAIL_PROVIDERS = [
  {
    value: "gmail" as const,
    label: "Gmail",
    badge: "RECOMMENDED",
    badgeColor: "green" as const,
    description: "Sends from your actual Gmail account.",
    hrSees: "From: {name} <{email}>",
    hrResult:
      "\u2705 No warnings \u00b7 \u2705 Primary inbox \u00b7 \u2705 Passes spam checks",
    previewBg: "bg-emerald-50 dark:bg-emerald-900/30 ring-emerald-200 dark:ring-emerald-800/40",
    fields: ["email", "appPassword"] as const,
    helpLink: "How to get a Gmail App Password",
    helpSteps: [
      "Go to myaccount.google.com",
      "Security \u2192 2-Step Verification (turn ON if not already)",
      "Search \u2018App Passwords\u2019 in settings",
      "Create new \u2192 Name: \u2018JobPilot\u2019",
      "Copy the 16-character password",
      "Set SMTP Host to smtp.gmail.com and SMTP Port to 587",
      "Enter your Gmail address as Email / Username",
      "Paste the 16-character password into App Password",
    ],
  },
  {
    value: "outlook" as const,
    label: "Outlook / Hotmail",
    badge: null,
    badgeColor: null,
    description: "Sends from your Outlook account.",
    hrSees: "From: {name} <{email}>",
    hrResult: "\u2705 No warnings \u00b7 \u2705 Primary inbox",
    previewBg: "bg-emerald-50 dark:bg-emerald-900/30 ring-emerald-200 dark:ring-emerald-800/40",
    fields: ["email", "appPassword"] as const,
    helpLink: "How to get an Outlook App Password",
    helpSteps: [
      "Go to account.microsoft.com",
      "Security \u2192 Advanced security options",
      "App passwords \u2192 Create a new app password",
      "Copy the generated password",
      "Set SMTP Host to smtp.office365.com and SMTP Port to 587",
      "Enter your Outlook address as Email / Username",
      "Paste the generated password into App Password",
    ],
  },
  {
    value: "custom" as const,
    label: "Custom SMTP",
    badge: "ADVANCED",
    badgeColor: "gray" as const,
    description: "Use your company or custom domain email server.",
    hrSees: "From: {name} <{email}>",
    hrResult: "\u2705 Professional company domain",
    previewBg: "bg-emerald-50 dark:bg-emerald-900/30 ring-emerald-200 dark:ring-emerald-800/40",
    fields: ["host", "port", "username", "password"] as const,
    helpLink: null,
    helpSteps: [],
  },
  {
    value: "brevo" as const,
    label: "Brevo",
    badge: "\u26a0\ufe0f BASIC",
    badgeColor: "yellow" as const,
    description:
      "Uses JobPilot\u2019s shared server. Quick start but may trigger spam filters.",
    hrSees: "From: {name} <{email}> \u26a0\ufe0f via brevo.com",
    hrResult:
      "\u26a0\ufe0f May land in Spam \u00b7 \u26a0\ufe0f \u2018via brevo.com\u2019 warning \u00b7 \u274c Fails spam checks",
    previewBg: "bg-amber-50 dark:bg-amber-900/30 ring-amber-200 dark:ring-amber-800/40",
    fields: [] as const,
    helpLink: null,
    helpSteps: [],
    warning: "For best results, switch to Gmail above.",
  },
] as const;

export type EmailProviderValue =
  (typeof EMAIL_PROVIDERS)[number]["value"];

export const SENDING_SAFETY_DEFAULTS = {
  sendDelaySeconds: 120,
  maxSendsPerHour: 8,
  maxSendsPerDay: 20,
  cooldownMinutes: 30,
  bouncePauseHours: 24,
} as const;

export const INSTANT_APPLY_DELAYS = [
  { value: 0, label: "Immediately" },
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
] as const;
