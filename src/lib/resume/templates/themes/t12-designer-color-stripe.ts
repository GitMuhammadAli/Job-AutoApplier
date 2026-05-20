/**
 * T12 — Designer Color Stripe.
 * Dark sidebar + emerald accent stripe between columns.
 * UI/UX / brand / creative. Still ATS-safe — no images, just colored backgrounds.
 * Plus Jakarta Sans head, Inter body.
 */

import type { TwoColumnTheme } from "../themed-two-column";

export const t12Theme: TwoColumnTheme = {
  id: "T12",
  version: "T12@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&family=Inter:wght@400;500;600&display=swap",
  fonts: {
    head: `"Plus Jakarta Sans", "Inter", "Helvetica Neue", Arial, sans-serif`,
    body: `"Inter", "Helvetica Neue", Arial, sans-serif`,
  },
  colors: {
    ink: "#0a0a0a",
    muted: "#525252",
    rule: "#d4d4d8",
    accent: "#059669",
    sidebarBg: "#18181b",
    sidebarInk: "#fafafa",
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
    bulletGapPx: 10,
  },
  h2: {
    transform: "uppercase",
    weight: 700,
    letterSpacingEm: 0.14,
    showRule: false,
  },
  sidebarFraction: 0.33,
  sidebarSections: ["skills", "education", "certifications"],
  sidebarSkillStyle: "chip",
  accentStripe: true,
};
