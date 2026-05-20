/**
 * T16 — Federal / Conservative.
 * Times New Roman, no flourish, maximally parser-friendly.
 * Government / regulated industries / very conservative tech-screen ATS.
 * Inline skills (no chips, no boxes — pure plain text).
 */

import type { SingleColumnTheme } from "../themed-single-column";

export const t16Theme: SingleColumnTheme = {
  id: "T16",
  version: "T16@1.0.0",
  // No web font — TNR ships on every OS. Avoids any parser surprises.
  googleFontsHref: "",
  fonts: {
    head: `"Times New Roman", Times, Georgia, serif`,
    body: `"Times New Roman", Times, Georgia, serif`,
  },
  colors: {
    ink: "#000000",
    muted: "#333333",
    rule: "#999999",
    accent: "#000000",
  },
  page: {
    width: "8.5in",
    height: "11in",
    paddingX: "0.8in",
    paddingY: "0.7in",
  },
  type: {
    bodyPt: 11,
    namePt: 20,
    headlinePt: 12,
    h2Pt: 12,
    contactPt: 10.5,
    bulletGapPx: 13,
  },
  h2: {
    transform: "uppercase",
    weight: 700,
    letterSpacingEm: 0.04,
    showRule: true,
  },
  skillStyle: "inline",
};
