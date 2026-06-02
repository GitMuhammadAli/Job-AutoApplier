/**
 * Resume API client — thin typed wrapper over fetch.
 *
 * All UI components call through here so:
 *   - There's one place to add interceptors / error normalization.
 *   - Responses are typed against the API contracts in `./types`.
 *   - We never type-cast at call sites.
 */

import type {
  ResumeProfile,
  ResumeRenderInput,
  GenerateRequest,
  RecommendExistingResumeRequest,
  RecommendExistingResumeResult,
} from "./types";
import type { TemplateRegistryEntry } from "./templates/registry";

export interface GenerateDiff {
  matchedKeywords: string[];
  promotedSkills: string[];
  featuredProjects: string[];
  pickedSummaryLabel: string | null;
  sectionOrderChanged: boolean;
  missingHardSkills: string[];
  roleFamily: string;
}

/**
 * Deterministic JD ↔ profile keyword coverage, surfaced to the UI so users
 * can see exactly which JD keywords landed on their PDF and which they're
 * missing entirely. `inProfileNotPicked` items get force-included by the
 * server (see `forcedProjects` / `forcedSkills`).
 */
export interface GenerateCoverage {
  covered: string[];
  inProfileNotPicked: string[];
  missing: string[];
  coverageRatio: number;
  forcedProjects: string[];
  forcedSkills: string[];
  /**
   * For each missing keyword that has adjacency in the user's profile:
   * the adjacent skills + projects + the canonical related-term list.
   * Lets the UI show "JD asks for WebRTC — you have Socket.IO + WebSockets,
   * worth mentioning?" without nudging fabrication.
   */
  missingWithAdjacency: Array<{
    keyword: string;
    adjacentSkills: string[];
    adjacentProjectIds: string[];
    relatedTerms: string[];
    hasAdjacency: boolean;
  }>;
  /**
   * Post-render integrity check — keywords the coverage report claimed
   * would be on the PDF but that grepping the rendered HTML proves
   * didn't actually land. Empty when the audit passed clean. UI shows
   * these as a separate ⚠ block so user knows the claim was overoptimistic
   * and can bump page-target or pick a different template.
   */
  auditNotLanded: string[];
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const resumeClient = {
  async getProfile(): Promise<ResumeProfile | null> {
    const res = await fetch("/api/resumes/profile", { cache: "no-store" });
    const data = await jsonOrThrow<{ profile: ResumeProfile | null }>(res);
    return data.profile;
  },

  async saveProfile(profile: ResumeProfile): Promise<ResumeProfile> {
    const res = await fetch("/api/resumes/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const data = await jsonOrThrow<{ profile: ResumeProfile }>(res);
    return data.profile;
  },

  async parsePdf(resumeId: string): Promise<{ candidate: ResumeProfile; warnings?: unknown[] }> {
    const res = await fetch("/api/resumes/profile/parse-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId }),
    });
    return jsonOrThrow<{ candidate: ResumeProfile; warnings?: unknown[] }>(res);
  },

  async generate(req: GenerateRequest): Promise<{
    generationId: string;
    templateId: string;
    templateVersion: string;
    pageTarget: number;
    template: string;
    previewUrl: string;
    pdfUrl: string;
    diff: GenerateDiff | null;
    warnings: string[];
    aiProvider: string | null;
    coverage: GenerateCoverage | null;
  }> {
    const res = await fetch("/api/resumes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return jsonOrThrow(res);
  },

  async listTemplates(): Promise<Array<Pick<TemplateRegistryEntry, "id" | "name" | "description" | "audience" | "layout" | "atsRank" | "available" | "version">>> {
    const res = await fetch("/api/resumes/templates");
    const data = await jsonOrThrow<{ templates: Array<Pick<TemplateRegistryEntry, "id" | "name" | "description" | "audience" | "layout" | "atsRank" | "available" | "version">> }>(res);
    return data.templates;
  },

  async recommendExisting(req: RecommendExistingResumeRequest): Promise<RecommendExistingResumeResult> {
    const res = await fetch("/api/resumes/recommend-existing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return jsonOrThrow<RecommendExistingResumeResult>(res);
  },
};

/**
 * Empty-state factory — returns a fresh, schema-valid profile for a brand-new user.
 * Used by Path B (start from scratch) in the onboarding wizard.
 */
export function emptyProfile(seedEmail = "", seedName = ""): ResumeProfile {
  return {
    header: {
      fullName: seedName,
      headline: "",
      email: seedEmail,
    },
    skills: [],
    skillsLocked: false,
    summaries: [],
    experiences: [],
    projects: [],
    education: [],
    certifications: [],
  };
}

export function buildRenderInputFromUploadedResume(_resumeId: string): never {
  throw new Error("Not implemented — only structured ResumeProfile is supported in v1");
}
