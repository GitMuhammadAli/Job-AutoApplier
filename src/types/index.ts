export type Stage = "SAVED" | "APPLIED" | "INTERVIEW" | "OFFER" | "REJECTED" | "GHOSTED";
export type Platform = "LINKEDIN" | "INDEED" | "GLASSDOOR" | "ROZEE_PK" | "BAYT" | "COMPANY_SITE" | "REFERRAL" | "OTHER";
export type WorkType = "ONSITE" | "REMOTE" | "HYBRID";
export type ApplyType = "EASY_APPLY" | "QUICK_APPLY" | "REGULAR" | "EMAIL" | "UNKNOWN";

export interface ApplyOption {
  link: string;
  source: string;
}

export interface Job {
  id: string;
  company: string;
  role: string;
  url?: string | null;
  platform: Platform;
  stage: Stage;
  applyType: ApplyType;
  isDirectApply: boolean;
  applyOptions?: ApplyOption[] | null;
  matchScore?: number | null;
  description?: string | null;
  salary?: string | null;
  location?: string | null;
  workType: WorkType;
  resumeId?: string | null;
  resumeUsed?: Resume | null;
  notes?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  appliedDate?: string | null;
  interviewDate?: string | null;
  followUpDate?: string | null;
  rejectedDate?: string | null;
  offerDate?: string | null;
  isGhosted?: boolean;
  isStale?: boolean;
  activities?: Activity[];
  createdAt: string;
  updatedAt: string;
}

export interface Resume {
  id: string;
  name: string;
  fileUrl?: string | null;
  userId: string;
  createdAt: string;
  _count?: { jobs: number };
}

export interface Activity {
  id: string;
  jobId: string;
  type: string;
  fromStage?: string | null;
  toStage?: string | null;
  note?: string | null;
  metadata?: unknown;
  createdAt: string;
}

export interface Analytics {
  totalJobs: number;
  totalApplied: number;
  interviews: number;
  offers: number;
  rejected: number;
  ghosted: number;
  responseRate: number;
}
