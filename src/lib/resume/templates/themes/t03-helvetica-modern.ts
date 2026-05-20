/**
 * T03 — Helvetica Modern.
 * Clean sans-serif (Inter), generous whitespace, modern startup look.
 * Tech, product, design-led companies. Chip skills.
 */

import type { SingleColumnTheme } from "../themed-single-column";

export const t03Theme: SingleColumnTheme = {
  id: "T03",
  version: "T03@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  fonts: {
    head: `"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif`,
    body: `"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif`,
  },
  colors: {
    ink: "#0f172a",
    muted: "#64748b",
    rule: "#e2e8f0",
    accent: "#0f172a",
  },
  page: {
    width: "8.5in",
    height: "11in",
    paddingX: "0.65in",
    paddingY: "0.65in",
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
    weight: 600,
    letterSpacingEm: 0.14,
    showRule: false,
  },
  skillStyle: "chip",
};
