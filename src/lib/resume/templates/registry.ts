/**
 * Resume template registry — 16 ATS-friendly templates.
 *
 * Architecture: 2 universal layouts (single-column, two-column) + theme tokens
 * per template. Adding a new template = adding one entry here + one theme file
 * under `./themes/`. No new render functions needed.
 *
 * Phase 1: T01 (ATS Clean) is fully implemented. The other 15 are catalogued
 * with `available: false` and rendered as "Coming soon" cards in the UI.
 *
 * ATS pass-rate notes are sourced from public studies (see
 * docs/resume-generator-design.md §13 for references).
 */

export type TemplateLayout = "single-column" | "two-column";

export type TemplateFontFamily =
  | "spaceGrotesk-dmSans" // T01
  | "georgia-georgia"     // T02 Harvard
  | "helvetica-helvetica" // T03 Modern
  | "interTight-inter"    // T04 Engineering
  | "instrument-inter"    // T05 Executive
  | "manrope-inter"       // T06 Minimalist
  | "satoshi-satoshi"     // T07 Achievement
  | "geist-inter"         // T08 Career Change
  | "inter-inter"         // T09 Student
  | "berkeleyMono-inter"  // T10 Senior IC
  | "inter-inter-sidebar" // T11 Sidebar
  | "interTight-inter-accent" // T12 Designer
  | "interTight-inter-timeline" // T13 PM
  | "interTight-inter-metrics"  // T14 Marketing
  | "georgia-georgia-multipage" // T15 Academic
  | "timesNewRoman-timesNewRoman"; // T16 Federal

export interface TemplateRegistryEntry {
  /** Stable identifier — never change. Used as ResumeVariant.templateId and ResumeGeneration.templateId. */
  id: string;
  /** Current version of this template's HTML/CSS. Bump when CSS changes — older generations regenerate against their pinned version. */
  version: string;
  /** Short display name. */
  name: string;
  /** One-line description for the picker. */
  description: string;
  /** Target audience tag. */
  audience: string;
  /** Layout family — determines which universal renderer is invoked. */
  layout: TemplateLayout;
  /** Font pairing token — resolved to concrete fonts in the renderer. */
  fonts: TemplateFontFamily;
  /** Subjective ATS pass-rate rank, 1–5. Single-column always >= 4. */
  atsRank: 1 | 2 | 3 | 4 | 5;
  /** Whether the renderer is implemented. Coming-soon entries are catalogued but disabled. */
  available: boolean;
  /** Whether the template applies an accent color (otherwise pure black/white). */
  hasAccent: boolean;
}

export const TEMPLATE_REGISTRY: readonly TemplateRegistryEntry[] = [
  // ── SINGLE COLUMN (ATS gold standard, 10 entries) ──────────────────
  {
    id: "T01",
    version: "T01@1.1.0",
    name: "ATS Clean",
    description: "Single-column, Space Grotesk + DM Sans. The safe default.",
    audience: "Default · FAANG · agency screens",
    layout: "single-column",
    fonts: "spaceGrotesk-dmSans",
    atsRank: 5,
    available: true,
    hasAccent: false,
  },
  {
    id: "T02",
    version: "T02@1.0.0",
    name: "Harvard Classic",
    description: "Times-style serif (Cormorant Garamond + Georgia), conservative, century-tested.",
    audience: "Law · finance · academia",
    layout: "single-column",
    fonts: "georgia-georgia",
    atsRank: 5,
    available: true,
    hasAccent: false,
  },
  {
    id: "T03",
    version: "T03@1.0.0",
    name: "Helvetica Modern",
    description: "Clean Inter sans, generous whitespace, no section rules.",
    audience: "Tech · startup · product",
    layout: "single-column",
    fonts: "helvetica-helvetica",
    atsRank: 5,
    available: true,
    hasAccent: false,
  },
  {
    id: "T04",
    version: "T04@1.0.0",
    name: "Compact Engineering",
    description: "Inter Tight, tight leading, projects-forward, emerald accent underline.",
    audience: "Software IC · senior eng",
    layout: "single-column",
    fonts: "interTight-inter",
    atsRank: 5,
    available: true,
    hasAccent: true,
  },
  {
    id: "T05",
    version: "T05@0.1.0",
    name: "Executive Bold",
    description: "Large name treatment, less density, executive presence.",
    audience: "Director · VP · C-suite",
    layout: "single-column",
    fonts: "instrument-inter",
    atsRank: 5,
    available: false,
    hasAccent: false,
  },
  {
    id: "T06",
    version: "T06@0.1.0",
    name: "Minimalist (Linear-style)",
    description: "Ultra-clean, minimal section dividers, modern.",
    audience: "Modern tech · design-led teams",
    layout: "single-column",
    fonts: "manrope-inter",
    atsRank: 4,
    available: false,
    hasAccent: false,
  },
  {
    id: "T07",
    version: "T07@0.1.0",
    name: "Achievement-Forward",
    description: "Metrics-led bullet treatment, KPI chips.",
    audience: "Sales · GTM · marketing",
    layout: "single-column",
    fonts: "satoshi-satoshi",
    atsRank: 4,
    available: false,
    hasAccent: true,
  },
  {
    id: "T08",
    version: "T08@0.1.0",
    name: "Career Change",
    description: "Skills section above experience, transferable-skills framing.",
    audience: "Pivot · re-skill",
    layout: "single-column",
    fonts: "geist-inter",
    atsRank: 4,
    available: false,
    hasAccent: false,
  },
  {
    id: "T09",
    version: "T09@0.1.0",
    name: "Student / Internship",
    description: "Education-first, projects + coursework prominent.",
    audience: "New grad · intern · bootcamp",
    layout: "single-column",
    fonts: "inter-inter",
    atsRank: 4,
    available: false,
    hasAccent: false,
  },
  {
    id: "T10",
    version: "T10@0.1.0",
    name: "Senior IC",
    description: "Deep technical depth, no fluff, scope/impact bullets.",
    audience: "Staff · Principal · senior eng",
    layout: "single-column",
    fonts: "berkeleyMono-inter",
    atsRank: 5,
    available: false,
    hasAccent: false,
  },

  // ── TWO-COLUMN (visual-leaning roles, 4 entries) ────────────────────
  {
    id: "T11",
    version: "T11@0.1.0",
    name: "Sidebar Skills",
    description: "Sidebar: contact + skills + education. Main: summary + experience + projects.",
    audience: "Generalist · mid-level",
    layout: "two-column",
    fonts: "inter-inter-sidebar",
    atsRank: 3,
    available: false,
    hasAccent: false,
  },
  {
    id: "T12",
    version: "T12@0.1.0",
    name: "Designer Color Stripe",
    description: "Subtle color accent stripe, still ATS-safe (no images).",
    audience: "UI/UX · brand · creative",
    layout: "two-column",
    fonts: "interTight-inter-accent",
    atsRank: 3,
    available: false,
    hasAccent: true,
  },
  {
    id: "T13",
    version: "T13@0.1.0",
    name: "PM Timeline",
    description: "Two-column with dates left, achievements right.",
    audience: "Product manager · ops",
    layout: "two-column",
    fonts: "interTight-inter-timeline",
    atsRank: 3,
    available: false,
    hasAccent: false,
  },
  {
    id: "T14",
    version: "T14@0.1.0",
    name: "Marketing Metrics",
    description: "KPI sidebar with reach/conversion numbers, achievement-led.",
    audience: "Growth · brand · analytics",
    layout: "two-column",
    fonts: "interTight-inter-metrics",
    atsRank: 3,
    available: false,
    hasAccent: true,
  },

  // ── SPECIALIZED (2 entries) ─────────────────────────────────────────
  {
    id: "T15",
    version: "T15@0.1.0",
    name: "Academic CV",
    description: "Multi-page tolerated, publications + research section.",
    audience: "Research · PhD · academia",
    layout: "single-column",
    fonts: "georgia-georgia-multipage",
    atsRank: 5,
    available: false,
    hasAccent: false,
  },
  {
    id: "T16",
    version: "T16@0.1.0",
    name: "Federal / Conservative",
    description: "Times Roman, no flourish, maximally parser-friendly.",
    audience: "Government · regulated industries",
    layout: "single-column",
    fonts: "timesNewRoman-timesNewRoman",
    atsRank: 5,
    available: false,
    hasAccent: false,
  },
];

/** Lookup helper — throws on unknown template id (caller is expected to validate). */
export function getTemplate(id: string): TemplateRegistryEntry {
  const t = TEMPLATE_REGISTRY.find((t) => t.id === id);
  if (!t) {
    throw new Error(`Unknown template id: ${id}`);
  }
  return t;
}

/** Only templates that are usable in v1. UI hides others behind "Coming soon". */
export function getAvailableTemplates(): readonly TemplateRegistryEntry[] {
  return TEMPLATE_REGISTRY.filter((t) => t.available);
}

/**
 * Pin a template's current version. Stored on ResumeVariant + ResumeGeneration
 * so future CSS tweaks don't silently change historical PDFs.
 */
export function getCurrentVersion(id: string): string {
  return getTemplate(id).version;
}

/** Default template — used when user doesn't pick one. */
export const DEFAULT_TEMPLATE_ID = "T01";
