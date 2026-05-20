/**
 * Render dispatcher — single entry point for HTML generation.
 *
 * Validates input → resolves template + layout → dispatches to themed renderer → audits.
 * Throws on bad input, missing template, or audit failure.
 *
 * Adding a new template:
 *   1. New theme file under ./templates/themes/ (SingleColumnTheme or TwoColumnTheme).
 *   2. Register in the appropriate THEMES map below.
 *   3. Flip `available: true` in registry.ts.
 */

import { ResumeRenderInputSchema, type ResumeRenderInput } from "./types";
import { getTemplate } from "./templates/registry";
import { renderThemedSingleColumn, type SingleColumnTheme } from "./templates/themed-single-column";
import { renderThemedTwoColumn, type TwoColumnTheme } from "./templates/themed-two-column";
import { t01Theme } from "./templates/themes/t01-ats-clean";
import { t02Theme } from "./templates/themes/t02-harvard-classic";
import { t03Theme } from "./templates/themes/t03-helvetica-modern";
import { t04Theme } from "./templates/themes/t04-compact-engineering";
import { t05Theme } from "./templates/themes/t05-executive-bold";
import { t06Theme } from "./templates/themes/t06-minimalist";
import { t07Theme } from "./templates/themes/t07-achievement-forward";
import { t08Theme } from "./templates/themes/t08-career-change";
import { t09Theme } from "./templates/themes/t09-student-internship";
import { t10Theme } from "./templates/themes/t10-senior-ic";
import { t11Theme } from "./templates/themes/t11-sidebar-skills";
import { t12Theme } from "./templates/themes/t12-designer-color-stripe";
import { t13Theme } from "./templates/themes/t13-pm-timeline";
import { t14Theme } from "./templates/themes/t14-marketing-metrics";
import { t15Theme } from "./templates/themes/t15-academic-cv";
import { t16Theme } from "./templates/themes/t16-federal-conservative";
import { auditNoFabrication, FabricationError } from "./audit";

const SINGLE_COLUMN_THEMES: Record<string, SingleColumnTheme> = {
  T01: t01Theme,
  T02: t02Theme,
  T03: t03Theme,
  T04: t04Theme,
  T05: t05Theme,
  T06: t06Theme,
  T07: t07Theme,
  T08: t08Theme,
  T09: t09Theme,
  T10: t10Theme,
  T15: t15Theme,
  T16: t16Theme,
};

const TWO_COLUMN_THEMES: Record<string, TwoColumnTheme> = {
  T11: t11Theme,
  T12: t12Theme,
  T13: t13Theme,
  T14: t14Theme,
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
    case "two-column": {
      const theme = TWO_COLUMN_THEMES[input.templateId];
      if (!theme) throw new TemplateNotAvailableError(input.templateId);
      html = renderThemedTwoColumn(inputForRender, { ...theme, version: templateVersion });
      break;
    }
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
