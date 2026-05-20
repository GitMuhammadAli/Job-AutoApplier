/**
 * T06 — Minimalist (Linear-style).
 * Manrope head + Inter body. Ultra-clean: no section rules, generous whitespace,
 * subtle lowercase headers. Modern tech, design-led teams.
 */

import type { SingleColumnTheme } from "../themed-single-column";

export const t06Theme: SingleColumnTheme = {
  id: "T06",
  version: "T06@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&family=Inter:wght@400;500&display=swap",
  fonts: {
    head: `"Manrope", "Inter", "Helvetica Neue", Arial, sans-serif`,
    body: `"Inter", "Helvetica Neue", Arial, sans-serif`,
  },
  colors: {
    ink: "#18181b",
    muted: "#71717a",
    rule: "#e4e4e7",
    accent: "#18181b",
  },
  page: {
    width: "8.5in",
    height: "11in",
    paddingX: "0.7in",
    paddingY: "0.7in",
  },
  type: {
    bodyPt: 10,
    namePt: 22,
    headlinePt: 11,
    h2Pt: 9,
    contactPt: 9,
    bulletGapPx: 13,
  },
  h2: {
    transform: "none",
    weight: 600,
    letterSpacingEm: 0,
    showRule: false,
  },
  skillStyle: "inline",
};
