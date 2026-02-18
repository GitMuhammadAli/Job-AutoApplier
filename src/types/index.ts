import type {
  JobStage,
  ApplicationStatus,
  ApplyMethod,
  ApplicationMode,
  ActivityType,
} from "@prisma/client";

export type { JobStage, ApplicationStatus, ApplyMethod, ApplicationMode, ActivityType };

// ── Global Job (shared, scraped once) ──

export interface GlobalJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  salary: string | null;
  jobType: string | null;
  experienceLevel: string | null;
  category: string | null;
  skills: string[];
  postedDate: Date | string | null;
  expiryDate: Date | string | null;
  source: string;
  sourceId: string;
  sourceUrl: string | null;
  applyUrl: string | null;
  companyUrl: string | null;
  companyEmail: string | null;
  isActive: boolean;
  lastSeenAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ── User Job (per-user view) ──

export interface UserJob {
  id: string;
  userId: string;
  globalJobId: string;
  stage: JobStage;
  matchScore: number | null;
  matchReasons: string[];
  notes: string | null;
  coverLetter: string | null;
  isBookmarked: boolean;
  isDismissed: boolean;
  dismissReason: string | null;
  lastFollowUpAt: Date | string | null;
  followUpCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UserJobWithGlobal extends UserJob {
  globalJob: GlobalJob;
  application?: {
    id: string;
    status: ApplicationStatus;
    sentAt: Date | string | null;
  } | null;
  activities?: Activity[];
}

// ── Job Application ──

export interface JobApplication {
  id: string;
  userJobId: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  emailBody: string;
  resumeId: string | null;
  coverLetter: string | null;
  templateId: string | null;
  status: ApplicationStatus;
  sentAt: Date | string | null;
  errorMessage: string | null;
  retryCount: number;
  appliedVia: ApplyMethod;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ── Resume ──

export interface Resume {
  id: string;
  userId: string;
  name: string;
  fileName: string | null;
  fileUrl: string | null;
  fileType: string | null;
  content: string | null;
  isDefault: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ── Activity ──

export interface Activity {
  id: string;
  userJobId: string;
  userId: string;
  type: ActivityType;
  description: string;
  createdAt: Date | string;
}

// ── Email Template ──

export interface EmailTemplate {
  id: string;
  userId: string;
  settingsId: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ── User Settings ──

export interface UserSettings {
  id: string;
  userId: string;
  fullName: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  githubUrl: string | null;
  keywords: string[];
  city: string | null;
  country: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  experienceLevel: string | null;
  education: string | null;
  workType: string[];
  jobType: string[];
  languages: string[];
  preferredCategories: string[];
  preferredPlatforms: string[];
  emailNotifications: boolean;
  notificationEmail: string | null;
  applicationEmail: string | null;
  applicationMode: ApplicationMode;
  autoApplyEnabled: boolean;
  maxAutoApplyPerDay: number;
  minMatchScoreForAutoApply: number;
  defaultSignature: string | null;
  customSystemPrompt: string | null;
  preferredTone: string | null;
  emailLanguage: string | null;
  includeLinkedin: boolean;
  includeGithub: boolean;
  includePortfolio: boolean;
  customClosing: string | null;
  isOnboarded: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ── Scraped Job (raw, before DB upsert) ──

export interface ScrapedJob {
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  salary: string | null;
  jobType: string | null;
  experienceLevel: string | null;
  category: string | null;
  skills: string[];
  postedDate: Date | null;
  source: string;
  sourceId: string;
  sourceUrl: string | null;
  applyUrl: string | null;
  companyUrl: string | null;
  companyEmail: string | null;
}

// ── Search Query (from keyword aggregator) ──

export interface SearchQuery {
  keyword: string;
  cities: string[];
}

// ── Analytics ──

export interface Analytics {
  totalJobs: number;
  totalApplied: number;
  interviews: number;
  offers: number;
  rejected: number;
  ghosted: number;
  responseRate: number;
}
