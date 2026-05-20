/**
 * T07 — Achievement-Forward.
 * Satoshi head + Inter body. Emerald accent on the name + section underlines.
 * Sales / GTM / marketing. Chip skills.
 */

import type { SingleColumnTheme } from "../themed-single-column";

export const t07Theme: SingleColumnTheme = {
  id: "T07",
  version: "T07@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Satoshi:wght@500;700&family=Inter:wght@400;500;600&display=swap",
  fonts: {
    head: `"Satoshi", "Inter", "Helvetica Neue", Arial, sans-serif`,
    body: `"Inter", "Helvetica Neue", Arial, sans-serif`,
  },
  colors: {
    ink: "#0a0a0a",
    muted: "#525252",
    rule: "#d4d4d8",
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
    namePt: 26,
    headlinePt: 11,
    h2Pt: 10,
    contactPt: 9,
    bulletGapPx: 11,
  },
  h2: {
    transform: "uppercase",
    weight: 700,
    letterSpacingEm: 0.12,
    showRule: false,
    accentUnderline: true,
  },
  skillStyle: "chip",
  nameAccent: false,
};
