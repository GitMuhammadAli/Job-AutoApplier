/**
 * T13 — PM Timeline.
 * Two-column with light sidebar carrying contact + education only.
 * Main column has summary + experience + projects, with prominent dates.
 * Product manager / ops / business roles.
 */

import type { TwoColumnTheme } from "../themed-two-column";

export const t13Theme: TwoColumnTheme = {
  id: "T13",
  version: "T13@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600&display=swap",
  fonts: {
    head: `"Inter Tight", "Inter", "Helvetica Neue", Arial, sans-serif`,
    body: `"Inter", "Helvetica Neue", Arial, sans-serif`,
  },
  colors: {
    ink: "#0a0a0a",
    muted: "#525252",
    rule: "#d4d4d8",
    accent: "#0a0a0a",
    sidebarBg: "#f4f4f5",
    sidebarInk: "#18181b",
  },
  page: {
    width: "8.5in",
    height: "11in",
    paddingX: "0.6in",
    paddingY: "0.55in",
  },
  type: {
    bodyPt: 10,
    namePt: 24,
    headlinePt: 11,
    h2Pt: 9.5,
    contactPt: 9,
    bulletGapPx: 12,
  },
  h2: {
    transform: "uppercase",
    weight: 700,
    letterSpacingEm: 0.1,
    showRule: true,
  },
  sidebarFraction: 0.28,
  sidebarSections: ["education", "certifications", "skills"],
  sidebarSkillStyle: "inline",
};
