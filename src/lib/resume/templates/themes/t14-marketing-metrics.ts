/**
 * T14 — Marketing Metrics.
 * Two-column with amber-accent sidebar carrying skills + certifications + education.
 * Main column has summary + experience + projects, achievement-led.
 * Growth / brand / analytics roles.
 */

import type { TwoColumnTheme } from "../themed-two-column";

export const t14Theme: TwoColumnTheme = {
  id: "T14",
  version: "T14@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Satoshi:wght@500;700&family=Inter:wght@400;500;600&display=swap",
  fonts: {
    head: `"Satoshi", "Inter Tight", "Inter", "Helvetica Neue", Arial, sans-serif`,
    body: `"Inter", "Helvetica Neue", Arial, sans-serif`,
  },
  colors: {
    ink: "#0a0a0a",
    muted: "#525252",
    rule: "#d4d4d8",
    accent: "#d97706",
    sidebarBg: "#fef3c7",
    sidebarInk: "#451a03",
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
    bulletGapPx: 11,
  },
  h2: {
    transform: "uppercase",
    weight: 700,
    letterSpacingEm: 0.14,
    showRule: false,
  },
  sidebarFraction: 0.32,
  sidebarSections: ["skills", "certifications", "education"],
  sidebarSkillStyle: "chip",
  accentStripe: true,
};
