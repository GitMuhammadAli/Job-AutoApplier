/**
 * Themed single-column renderer.
 *
 * Takes an input + a SingleColumnTheme and emits a full ATS-clean HTML doc.
 * Each template T01-T16 (single-column subset) is just a theme — no new
 * renderer code per template.
 *
 * Adding a new template: drop a new ts file under ./themes/ exporting a
 * `SingleColumnTheme` object + register it in registry.ts.
 */

import type { ResumeRenderInput } from "../types";
import { escapeHtml, normalizeDisplayName, renderHeader, renderBody } from "./sections";

export interface SingleColumnTheme {
  id: string;
  version: string;
  /** Google Fonts href URL (or empty if using system fonts). */
  googleFontsHref: string;
  /** font-family CSS values. */
  fonts: {
    head: string;
    body: string;
  };
  /** Hex color tokens. */
  colors: {
    ink: string;
    muted: string;
    rule: string;
    /** Optional accent — none for pure ATS templates. */
    accent: string;
  };
  /** Page sizing in inches/CSS units. */
  page: {
    width: string;
    height: string;
    paddingX: string;
    paddingY: string;
  };
  /** Type scale (pt sizes). */
  type: {
    bodyPt: number;
    namePt: number;
    headlinePt: number;
    h2Pt: number;
    contactPt: number;
    bulletGapPx: number;
  };
  /** Section H2 styling. */
  h2: {
    transform: "uppercase" | "capitalize" | "none";
    weight: number;
    letterSpacingEm: number;
    /** Show a 1px rule under the section header. */
    showRule: boolean;
    /** Optional left-aligned underline accent (color from theme.colors.accent). */
    accentUnderline?: boolean;
  };
  /** Render skills as chips (boxed) or inline (dot-separated). */
  skillStyle: "chip" | "inline";
  /** Optional override for accent color usage on the name. */
  nameAccent?: boolean;
}

export function renderThemedSingleColumn(
  input: ResumeRenderInput,
  theme: SingleColumnTheme,
): string {
  if (input.templateId !== theme.id) {
    throw new Error(`Theme ${theme.id} received templateId=${input.templateId}`);
  }
  const pageClass =
    input.pageTarget === "unlimited"
      ? "rs-page-unlimited"
      : input.pageTarget === 2
        ? "rs-page-2"
        : "rs-page-1";
  const body = renderBody(input, { skillStyle: theme.skillStyle });

  const accentUnderlineCss = theme.h2.accentUnderline
    ? `border-bottom: 2px solid ${theme.colors.accent};`
    : theme.h2.showRule
      ? `border-bottom: 1px solid ${theme.colors.rule};`
      : "";

  const nameColor = theme.nameAccent ? theme.colors.accent : theme.colors.ink;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(normalizeDisplayName(input.header.fullName))} &mdash; Resume</title>
  <meta name="generator" content="JobPilot ${theme.version}" />
  ${theme.googleFontsHref ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${theme.googleFontsHref}" rel="stylesheet">` : ""}
  <style>
    :root {
      --ink: ${theme.colors.ink};
      --muted: ${theme.colors.muted};
      --rule: ${theme.colors.rule};
      --accent: ${theme.colors.accent};
      --page-w: ${theme.page.width};
      --page-h: ${theme.page.height};
      --pad-x: ${theme.page.paddingX};
      --pad-y: ${theme.page.paddingY};
      --font-head: ${theme.fonts.head};
      --font-body: ${theme.fonts.body};
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ececec; font-family: var(--font-body); color: var(--ink); }
    body { padding: 24px 0; }
    .rs-doc {
      width: var(--page-w);
      min-height: var(--page-h);
      margin: 0 auto;
      background: #fff;
      padding: var(--pad-y) var(--pad-x);
      box-shadow: 0 6px 30px rgba(0,0,0,0.08);
      font-size: ${theme.type.bodyPt}pt;
      line-height: 1.35;
    }
    .rs-page-1 { font-size: ${theme.type.bodyPt - 0.5}pt; }
    .rs-page-1 .rs-section { margin-top: 10px; }
    /* Academic CV — let the doc grow as needed; print engine paginates */
    .rs-page-unlimited { min-height: 0; }
    .rs-page-unlimited .rs-section { page-break-inside: avoid; margin-top: 14px; }

    .rs-header { text-align: left; margin-bottom: 8px; }
    .rs-name {
      font-family: var(--font-head);
      font-weight: ${theme.h2.weight};
      font-size: ${theme.type.namePt}pt;
      letter-spacing: -0.01em;
      margin: 0 0 2px 0;
      color: ${nameColor};
    }
    .rs-headline {
      font-family: var(--font-head);
      font-weight: 500;
      font-size: ${theme.type.headlinePt}pt;
      color: var(--muted);
      margin: 0 0 6px 0;
    }
    .rs-contact { font-size: ${theme.type.contactPt}pt; color: var(--muted); margin: 1px 0; }
    .rs-contact a { color: var(--ink); text-decoration: none; }
    .rs-contact a:hover { text-decoration: underline; }
    .dot { color: var(--rule); padding: 0 4px; }

    .rs-section { margin-top: 14px; }
    .rs-h2 {
      font-family: var(--font-head);
      font-weight: ${theme.h2.weight};
      font-size: ${theme.type.h2Pt}pt;
      ${theme.h2.transform !== "none" ? `text-transform: ${theme.h2.transform};` : ""}
      letter-spacing: ${theme.h2.letterSpacingEm}em;
      color: var(--ink);
      padding-bottom: 3px;
      ${accentUnderlineCss}
      margin: 0 0 8px 0;
    }
    .rs-summary { margin: 0; }
    .rs-muted { color: var(--muted); }

    .rs-skills-chip { display: flex; flex-wrap: wrap; gap: 4px 0; line-height: 1.6; }
    .rs-skill {
      font-size: ${theme.type.contactPt}pt;
      padding: 1px 7px;
      margin-right: 4px;
      border: 1px solid var(--rule);
      border-radius: 3px;
      white-space: nowrap;
      color: var(--ink);
    }
    .rs-skills-inline { line-height: 1.6; font-size: ${theme.type.contactPt}pt; }

    .rs-entry { margin-bottom: ${theme.type.bulletGapPx}px; page-break-inside: avoid; }
    .rs-entry:last-child { margin-bottom: 0; }
    .rs-entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 2px; }
    .rs-entry-title { font-size: ${theme.type.bodyPt}pt; }
    .rs-entry-title strong { font-weight: ${theme.h2.weight}; }
    .rs-entry-dates { font-size: ${theme.type.contactPt}pt; color: var(--muted); white-space: nowrap; }
    .rs-stack { font-size: ${theme.type.contactPt}pt; margin-bottom: 3px; }
    .rs-bullets { list-style: disc; padding-left: 18px; margin: 2px 0 0 0; }
    .rs-bullets li { margin-bottom: 2px; }
    .rs-cert-list { padding-left: 18px; margin: 0; }

    @media print {
      body { background: #fff; padding: 0; }
      .rs-doc { box-shadow: none; margin: 0; width: auto; min-height: auto; }
      @page { size: letter; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="rs-doc ${pageClass}">
    ${renderHeader(input.header)}
    ${body}
  </div>
</body>
</html>`;
}
