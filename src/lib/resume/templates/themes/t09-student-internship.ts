/**
 * T09 — Student / Internship.
 * Inter throughout, friendly type scale. Hint: keep `education` near the top
 * of sectionOrder for fresh grads. New grads / interns / bootcamp recruits.
 */

import type { SingleColumnTheme } from "../themed-single-column";

export const t09Theme: SingleColumnTheme = {
  id: "T09",
  version: "T09@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  fonts: {
    head: `"Inter", "Helvetica Neue", Arial, sans-serif`,
    body: `"Inter", "Helvetica Neue", Arial, sans-serif`,
  },
  colors: {
    ink: "#0f172a",
    muted: "#64748b",
    rule: "#cbd5e1",
    accent: "#0f172a",
  },
  page: {
    width: "8.5in",
    height: "11in",
    paddingX: "0.7in",
    paddingY: "0.65in",
  },
  type: {
    bodyPt: 10.5,
    namePt: 22,
    headlinePt: 11.5,
    h2Pt: 10,
    contactPt: 9.5,
    bulletGapPx: 13,
  },
  h2: {
    transform: "uppercase",
    weight: 600,
    letterSpacingEm: 0.1,
    showRule: true,
  },
  skillStyle: "chip",
};
