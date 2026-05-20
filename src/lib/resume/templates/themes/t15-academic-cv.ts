/**
 * T15 — Academic CV.
 * Multi-page tolerated. EB Garamond + Lora pairing. Inline skills.
 * Research / PhD / academia. Page-fit logic upstream allows overflow for this id.
 */

import type { SingleColumnTheme } from "../themed-single-column";

export const t15Theme: SingleColumnTheme = {
  id: "T15",
  version: "T15@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500;700&family=Lora:wght@400;500&display=swap",
  fonts: {
    head: `"EB Garamond", Georgia, "Times New Roman", serif`,
    body: `"Lora", Georgia, "Times New Roman", serif`,
  },
  colors: {
    ink: "#111111",
    muted: "#555555",
    rule: "#cccccc",
    accent: "#111111",
  },
  page: {
    width: "8.5in",
    height: "11in",
    paddingX: "0.7in",
    paddingY: "0.65in",
  },
  type: {
    bodyPt: 11,
    namePt: 26,
    headlinePt: 12,
    h2Pt: 11,
    contactPt: 10,
    bulletGapPx: 14,
  },
  h2: {
    transform: "uppercase",
    weight: 700,
    letterSpacingEm: 0.1,
    showRule: true,
  },
  skillStyle: "inline",
};
