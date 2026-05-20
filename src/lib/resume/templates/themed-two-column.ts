/**
 * Themed two-column renderer.
 *
 * Two-column ATS rules: keep them parser-friendly. We use CSS grid (not
 * floats / not tables) with the SAME HTML reading order as single-column —
 * sidebar content lives ABOVE main content in the source. ATS parsers see
 * the linearized markup; the grid only matters for visual layout.
 *
 * Sidebar by default carries: contact, skills, education, certifications.
 * Main: summary, experience, projects.
 * Themes can override `sidebarSections` to relocate things.
 */

import type { ResumeRenderInput, SectionKey } from "../types";
import {
  escapeHtml,
  link,
  renderSummary,
  renderSkills,
  renderExperience,
  renderProjects,
  renderEducation,
  renderCertifications,
} from "./sections";

export interface TwoColumnTheme {
  id: string;
  version: string;
  googleFontsHref: string;
  fonts: { head: string; body: string };
  colors: {
    ink: string;
    muted: string;
    rule: string;
    accent: string;
    sidebarBg: string;
    sidebarInk: string;
  };
  page: { width: string; height: string; paddingX: string; paddingY: string };
  type: {
    bodyPt: number;
    namePt: number;
    headlinePt: number;
    h2Pt: number;
    contactPt: number;
    bulletGapPx: number;
  };
  h2: {
    transform: "uppercase" | "capitalize" | "none";
    weight: number;
    letterSpacingEm: number;
    showRule: boolean;
  };
  /** Fraction of total width allocated to sidebar. 0.30 = 30% sidebar. */
  sidebarFraction: number;
  /** Which sections go in the sidebar. Everything else goes in main. */
  sidebarSections: SectionKey[];
  /** Skill rendering style in the sidebar. Defaults to inline. */
  sidebarSkillStyle?: "chip" | "inline";
  /** Show a vertical color stripe between columns (uses theme.colors.accent). */
  accentStripe?: boolean;
}

function renderHeaderTwoCol(h: ResumeRenderInput["header"]): string {
  const links: string[] = [];
  if (h.websiteUrl) links.push(link(h.websiteUrl, h.websiteUrl.replace(/^https?:\/\//, "")));
  if (h.githubUrl) links.push(link(h.githubUrl, h.githubUrl.replace(/^https?:\/\//, "")));
  if (h.linkedinUrl) links.push(link(h.linkedinUrl, h.linkedinUrl.replace(/^https?:\/\//, "")));
  return `
  <div class="rs-tc-sidebar-contact">
    ${h.email ? `<p class="rs-tc-contact-line">${escapeHtml(h.email)}</p>` : ""}
    ${h.phone ? `<p class="rs-tc-contact-line">${escapeHtml(h.phone)}</p>` : ""}
    ${h.location ? `<p class="rs-tc-contact-line">${escapeHtml(h.location)}</p>` : ""}
    ${links.map((l) => `<p class="rs-tc-contact-line">${l}</p>`).join("")}
  </div>`;
}

function renderSidebarSection(key: SectionKey, input: ResumeRenderInput, theme: TwoColumnTheme): string {
  const style = theme.sidebarSkillStyle ?? "inline";
  switch (key) {
    case "skills":
      return renderSkills(input.skills, { style });
    case "education":
      return renderEducation(input.education);
    case "certifications":
      return renderCertifications(input.certifications);
    case "summary":
      return renderSummary(input.summary);
    case "experience":
      return renderExperience(input.experiences);
    case "projects":
      return renderProjects(input.projects);
    default:
      return "";
  }
}

export function renderThemedTwoColumn(
  input: ResumeRenderInput,
  theme: TwoColumnTheme,
): string {
  if (input.templateId !== theme.id) {
    throw new Error(`Theme ${theme.id} received templateId=${input.templateId}`);
  }
  const pageClass = input.pageTarget === 2 ? "rs-page-2" : "rs-page-1";

  const sidebarSet = new Set(theme.sidebarSections);
  const sidebarOrder: SectionKey[] = input.sectionOrder.filter((k) => sidebarSet.has(k));
  const mainOrder: SectionKey[] = input.sectionOrder.filter((k) => !sidebarSet.has(k));

  // Ensure key sidebar items always render even if not in sectionOrder
  for (const k of theme.sidebarSections) {
    if (!sidebarOrder.includes(k) && hasContent(k, input)) sidebarOrder.push(k);
  }

  const sidebarHtml = [
    renderHeaderTwoCol(input.header),
    ...sidebarOrder.map((k) => renderSidebarSection(k, input, theme)),
  ].join("\n");

  const mainHtml = mainOrder
    .map((k) => renderSidebarSection(k, input, theme))
    .join("\n");

  const sidebarPct = (theme.sidebarFraction * 100).toFixed(1);
  const mainPct = ((1 - theme.sidebarFraction) * 100).toFixed(1);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.header.fullName)} &mdash; Resume</title>
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
      --sidebar-bg: ${theme.colors.sidebarBg};
      --sidebar-ink: ${theme.colors.sidebarInk};
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
      box-shadow: 0 6px 30px rgba(0,0,0,0.08);
      font-size: ${theme.type.bodyPt}pt;
      line-height: 1.35;
      display: grid;
      grid-template-columns: ${sidebarPct}% ${mainPct}%;
    }

    /* Header band — full width across both columns */
    .rs-tc-header {
      grid-column: 1 / -1;
      padding: var(--pad-y) var(--pad-x) ${theme.h2.showRule ? 'calc(var(--pad-y) * 0.4)' : '0'} var(--pad-x);
      background: var(--sidebar-bg);
      color: var(--sidebar-ink);
      ${theme.accentStripe ? `border-bottom: 3px solid var(--accent);` : ""}
    }
    .rs-tc-name {
      font-family: var(--font-head);
      font-weight: ${theme.h2.weight};
      font-size: ${theme.type.namePt}pt;
      letter-spacing: -0.01em;
      margin: 0;
      color: var(--sidebar-ink);
    }
    .rs-tc-headline {
      font-family: var(--font-head);
      font-weight: 500;
      font-size: ${theme.type.headlinePt}pt;
      color: var(--sidebar-ink);
      opacity: 0.7;
      margin: 4px 0 0 0;
    }

    /* Sidebar column */
    .rs-tc-sidebar {
      background: var(--sidebar-bg);
      color: var(--sidebar-ink);
      padding: calc(var(--pad-y) * 0.7) calc(var(--pad-x) * 0.75);
      font-size: ${theme.type.bodyPt - 0.5}pt;
      ${theme.accentStripe ? `border-right: 3px solid var(--accent);` : ""}
    }
    .rs-tc-sidebar .rs-h2 { color: var(--sidebar-ink); }
    .rs-tc-sidebar .rs-muted { color: var(--sidebar-ink); opacity: 0.7; }
    .rs-tc-sidebar a { color: var(--sidebar-ink); }
    .rs-tc-sidebar-contact { margin-bottom: 16px; }
    .rs-tc-contact-line { font-size: ${theme.type.contactPt}pt; margin: 2px 0; word-break: break-all; }

    /* Main column */
    .rs-tc-main {
      padding: calc(var(--pad-y) * 0.7) var(--pad-x);
    }

    /* Shared section styles */
    .rs-section { margin-top: 14px; }
    .rs-section:first-child { margin-top: 0; }
    .rs-h2 {
      font-family: var(--font-head);
      font-weight: ${theme.h2.weight};
      font-size: ${theme.type.h2Pt}pt;
      ${theme.h2.transform !== "none" ? `text-transform: ${theme.h2.transform};` : ""}
      letter-spacing: ${theme.h2.letterSpacingEm}em;
      color: var(--ink);
      padding-bottom: 3px;
      ${theme.h2.showRule ? `border-bottom: 1px solid var(--rule);` : ""}
      margin: 0 0 8px 0;
    }
    .rs-summary { margin: 0; }
    .rs-muted { color: var(--muted); }
    .dot { color: var(--rule); padding: 0 4px; }

    .rs-skills-chip { display: flex; flex-wrap: wrap; gap: 4px 0; line-height: 1.6; }
    .rs-skill {
      font-size: ${theme.type.contactPt}pt;
      padding: 1px 7px;
      margin-right: 4px;
      border: 1px solid var(--rule);
      border-radius: 3px;
      white-space: nowrap;
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
    <header class="rs-tc-header">
      <h1 class="rs-tc-name">${escapeHtml(input.header.fullName)}</h1>
      <p class="rs-tc-headline">${escapeHtml(input.header.headline)}</p>
    </header>
    <aside class="rs-tc-sidebar">${sidebarHtml}</aside>
    <main class="rs-tc-main">${mainHtml}</main>
  </div>
</body>
</html>`;
}

function hasContent(key: SectionKey, input: ResumeRenderInput): boolean {
  switch (key) {
    case "summary": return Boolean(input.summary);
    case "skills": return input.skills.length > 0;
    case "experience": return input.experiences.length > 0;
    case "projects": return input.projects.length > 0;
    case "education": return input.education.length > 0;
    case "certifications": return input.certifications.length > 0;
    default: return false;
  }
}
