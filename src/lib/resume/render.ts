/**
 * Render dispatcher — single entry point for HTML generation.
 *
 * Usage:
 *   const result = renderResume(input);   // pure, throws on bad input/audit fail
 *
 * Validates → resolves template → dispatches to the themed renderer → audits.
 * If the audit fails, we throw — never return potentially fabricated output.
 *
 * Adding a new template:
 *   1. Drop a theme file under ./templates/themes/ exporting a SingleColumnTheme.
 *   2. Register in ./templates/registry.ts with `available: true`.
 *   3. Add the case below.
 * No new renderer code needed — the themed renderer handles all single-column variants.
 */

import { ResumeRenderInputSchema, type ResumeRenderInput } from "./types";
import { getTemplate } from "./templates/registry";
import { renderThemedSingleColumn, type SingleColumnTheme } from "./templates/themed-single-column";
import { t01Theme } from "./templates/themes/t01-ats-clean";
import { t02Theme } from "./templates/themes/t02-harvard-classic";
import { t03Theme } from "./templates/themes/t03-helvetica-modern";
import { t04Theme } from "./templates/themes/t04-compact-engineering";
import { auditNoFabrication, FabricationError } from "./audit";

const SINGLE_COLUMN_THEMES: Record<string, SingleColumnTheme> = {
  T01: t01Theme,
  T02: t02Theme,
  T03: t03Theme,
  T04: t04Theme,
};

export interface RenderResult {
  html: string;
  templateId: string;
  templateVersion: string;
  auditOkTokens: number;
}

export class TemplateNotAvailableError extends Error {
  constructor(templateId: string) {
    super(`Template ${templateId} is registered but not yet implemented`);
    this.name = "TemplateNotAvailableError";
  }
}

export function renderResume(rawInput: ResumeRenderInput): RenderResult {
  const input = ResumeRenderInputSchema.parse(rawInput);

  const tpl = getTemplate(input.templateId);
  if (!tpl.available) {
    throw new TemplateNotAvailableError(input.templateId);
  }

  // Pin the registry's current version into the input so the renderer's
  // <meta generator> tag matches what we persist in ResumeGeneration.
  const templateVersion = tpl.version;
  const inputForRender = { ...input, templateVersion };

  let html: string;
  switch (tpl.layout) {
    case "single-column": {
      const theme = SINGLE_COLUMN_THEMES[input.templateId];
      if (!theme) throw new TemplateNotAvailableError(input.templateId);
      html = renderThemedSingleColumn(inputForRender, { ...theme, version: templateVersion });
      break;
    }
    case "two-column":
      // T11–T14 land in a later phase. The registry still gates with `available: false`.
      throw new TemplateNotAvailableError(input.templateId);
    default:
      throw new TemplateNotAvailableError(input.templateId);
  }

  const auditResult = auditNoFabrication(input, html);
  if (!auditResult.ok) {
    throw new FabricationError(auditResult.fabricated);
  }

  return {
    html,
    templateId: input.templateId,
    templateVersion,
    auditOkTokens: auditResult.totalTokens,
  };
}
