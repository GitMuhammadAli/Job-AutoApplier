/**
 * T02 — Harvard Classic.
 * Conservative serif (Georgia + Cormorant Garamond), centuries-tested.
 * Law, finance, academia. Inline skills (dot-separated, no chips).
 */

import type { SingleColumnTheme } from "../themed-single-column";

export const t02Theme: SingleColumnTheme = {
  id: "T02",
  version: "T02@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&display=swap",
  fonts: {
    head: `"Cormorant Garamond", "Times New Roman", Georgia, serif`,
    body: `Georgia, "Times New Roman", serif`,
  },
  colors: {
    ink: "#0a0a0a",
    muted: "#4a4a4a",
    rule: "#bdbdbd",
    accent: "#0a0a0a",
  },
  page: {
    width: "8.5in",
    height: "11in",
    paddingX: "0.7in",
    paddingY: "0.6in",
  },
  type: {
    bodyPt: 10.5,
    namePt: 26,
    headlinePt: 12,
    h2Pt: 11,
    contactPt: 9.5,
    bulletGapPx: 12,
  },
  h2: {
    transform: "uppercase",
    weight: 700,
    letterSpacingEm: 0.12,
    showRule: true,
  },
  skillStyle: "inline",
};
