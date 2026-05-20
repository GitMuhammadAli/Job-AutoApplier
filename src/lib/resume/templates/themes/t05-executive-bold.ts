/**
 * T05 — Executive Bold.
 * Large name treatment, less density, executive presence.
 * Director / VP / C-suite. Inline skills (no chips — exec resumes look weak with boxed skills).
 */

import type { SingleColumnTheme } from "../themed-single-column";

export const t05Theme: SingleColumnTheme = {
  id: "T05",
  version: "T05@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap",
  fonts: {
    head: `"Instrument Serif", "Times New Roman", Georgia, serif`,
    body: `"Inter", "Helvetica Neue", Arial, sans-serif`,
  },
  colors: {
    ink: "#0a0a0a",
    muted: "#525252",
    rule: "#cccccc",
    accent: "#0a0a0a",
  },
  page: {
    width: "8.5in",
    height: "11in",
    paddingX: "0.75in",
    paddingY: "0.75in",
  },
  type: {
    bodyPt: 10.5,
    namePt: 34,
    headlinePt: 12,
    h2Pt: 10,
    contactPt: 9.5,
    bulletGapPx: 14,
  },
  h2: {
    transform: "uppercase",
    weight: 600,
    letterSpacingEm: 0.16,
    showRule: true,
  },
  skillStyle: "inline",
};
