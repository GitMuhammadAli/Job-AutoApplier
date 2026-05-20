/**
 * T11 — Sidebar Skills.
 * Standard two-column. Sidebar carries contact + skills + education.
 * Main carries summary + experience + projects.
 * Neutral light sidebar (zinc-50). Inter throughout.
 */

import type { TwoColumnTheme } from "../themed-two-column";

export const t11Theme: TwoColumnTheme = {
  id: "T11",
  version: "T11@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  fonts: {
    head: `"Inter", "Helvetica Neue", Arial, sans-serif`,
    body: `"Inter", "Helvetica Neue", Arial, sans-serif`,
  },
  colors: {
    ink: "#0a0a0a",
    muted: "#525252",
    rule: "#d4d4d8",
    accent: "#0a0a0a",
    sidebarBg: "#fafafa",
    sidebarInk: "#0a0a0a",
  },
  page: {
    width: "8.5in",
    height: "11in",
    paddingX: "0.6in",
    paddingY: "0.55in",
  },
  type: {
    bodyPt: 10,
    namePt: 22,
    headlinePt: 11,
    h2Pt: 9.5,
    contactPt: 9,
    bulletGapPx: 10,
  },
  h2: {
    transform: "uppercase",
    weight: 600,
    letterSpacingEm: 0.12,
    showRule: false,
  },
  sidebarFraction: 0.32,
  sidebarSections: ["skills", "education", "certifications"],
  sidebarSkillStyle: "inline",
};
