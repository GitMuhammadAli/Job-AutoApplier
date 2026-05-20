/**
 * T10 — Senior IC.
 * Deep technical depth — JetBrains Mono section headers signal "I work in code."
 * Staff / Principal / senior eng. Chip skills (precise tech stack matters).
 */

import type { SingleColumnTheme } from "../themed-single-column";

export const t10Theme: SingleColumnTheme = {
  id: "T10",
  version: "T10@1.0.0",
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;500;600&display=swap",
  fonts: {
    head: `"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`,
    body: `"Inter", "Helvetica Neue", Arial, sans-serif`,
  },
  colors: {
    ink: "#0a0a0a",
    muted: "#4a4a4a",
    rule: "#cccccc",
    accent: "#1e293b",
  },
  page: {
    width: "8.5in",
    height: "11in",
    paddingX: "0.55in",
    paddingY: "0.55in",
  },
  type: {
    bodyPt: 9.5,
    namePt: 18,
    headlinePt: 10,
    h2Pt: 8.5,
    contactPt: 8.5,
    bulletGapPx: 9,
  },
  h2: {
    transform: "uppercase",
    weight: 700,
    letterSpacingEm: 0.15,
    showRule: false,
  },
  skillStyle: "chip",
};
