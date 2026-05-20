/**
 * T08 — Career Change.
 * Geist head + Inter body. Skills get extra visual weight (chip + accent border).
 * Hint to the user: put `skills` ABOVE `experience` in sectionOrder.
 * For pivot / re-skill resumes.
 */

import type { SingleColumnTheme } from "../themed-single-column";

export const t08Theme: SingleColumnTheme = {
  id: "T08",
  version: "T08@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Geist:wght@500;600;700&family=Inter:wght@400;500;600&display=swap",
  fonts: {
    head: `"Geist", "Inter", "Helvetica Neue", Arial, sans-serif`,
    body: `"Inter", "Helvetica Neue", Arial, sans-serif`,
  },
  colors: {
    ink: "#0a0a0a",
    muted: "#525252",
    rule: "#a1a1aa",
    accent: "#0a0a0a",
  },
  page: {
    width: "8.5in",
    height: "11in",
    paddingX: "0.65in",
    paddingY: "0.6in",
  },
  type: {
    bodyPt: 10,
    namePt: 22,
    headlinePt: 11,
    h2Pt: 10,
    contactPt: 9,
    bulletGapPx: 12,
  },
  h2: {
    transform: "uppercase",
    weight: 700,
    letterSpacingEm: 0.1,
    showRule: true,
  },
  skillStyle: "chip",
};
