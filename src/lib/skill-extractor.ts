import { SKILL_ALIASES } from "@/constants/skills";

function buildSkillPattern(variant: string): RegExp {
  const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startsWord = /^\w/.test(variant) ? "\\b" : "(?<![\\w])";
  const endsWord = /\w$/.test(variant) ? "\\b" : "(?![\\w])";
  return new RegExp(`${startsWord}${escaped}${endsWord}`, "i");
}

export function extractSkillsFromContent(text: string): string[] {
  if (!text || text.trim().length < 10) return [];

  const normalised = text
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[•·‣▪–—]/g, " ");

  const found: string[] = [];

  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    const allVariants = [canonical, ...aliases];
    for (const variant of allVariants) {
      if (buildSkillPattern(variant).test(normalised)) {
        found.push(canonical);
        break;
      }
    }
  }

  return found;
}
