/**
 * T04 — Compact Engineering.
 * Dense single-column, Inter Tight + JetBrains Mono for code-stack chips,
 * tight leading. Designed for senior IC software engineers with deep
 * projects-forward stories. Chip skills (mono).
 */

import type { SingleColumnTheme } from "../themed-single-column";

export const t04Theme: SingleColumnTheme = {
  id: "T04",
  version: "T04@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500&display=swap",
  fonts: {
    head: `"Inter Tight", "Inter", "Helvetica Neue", Arial, sans-serif`,
    body: `"Inter", "Helvetica Neue", Arial, sans-serif`,
  },
  colors: {
    ink: "#0a0a0a",
    muted: "#525252",
    rule: "#d4d4d8",
    accent: "#16a34a",
  },
  page: {
    width: "8.5in",
    height: "11in",
    paddingX: "0.55in",
    paddingY: "0.5in",
  },
  type: {
    bodyPt: 9.5,
    namePt: 20,
    headlinePt: 10.5,
    h2Pt: 9,
    contactPt: 8.5,
    bulletGapPx: 8,
  },
  h2: {
    transform: "uppercase",
    weight: 700,
    letterSpacingEm: 0.1,
    showRule: false,
    accentUnderline: true,
  },
  skillStyle: "chip",
};
