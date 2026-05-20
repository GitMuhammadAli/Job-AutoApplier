/**
 * T01 — ATS Clean.
 * Default. Single-column, Space Grotesk + DM Sans, no accent, chip skills.
 * Tuned for maximum ATS parse rate.
 */

import type { SingleColumnTheme } from "../themed-single-column";

export const t01Theme: SingleColumnTheme = {
  id: "T01",
  version: "T01@1.1.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=DM+Sans:wght@400;500&display=swap",
  fonts: {
    head: `"Space Grotesk", "Helvetica Neue", Arial, sans-serif`,
    body: `"DM Sans", "Helvetica Neue", Arial, sans-serif`,
  },
  colors: {
    ink: "#111111",
    muted: "#555555",
    rule: "#d8d8d8",
    accent: "#059669",
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
    h2Pt: 10,
    contactPt: 9,
    bulletGapPx: 10,
  },
  h2: {
    transform: "uppercase",
    weight: 700,
    letterSpacingEm: 0.08,
    showRule: true,
  },
  skillStyle: "chip",
};
