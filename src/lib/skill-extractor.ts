import { SKILL_ALIASES } from "@/constants/skills";

/**
 * Extracts canonical skill names from text using word-boundary regex.
 * Uses SKILL_ALIASES from constants/skills.ts for alias → canonical mapping.
 * Also checks the canonical name itself as a match target.
 */
export function extractSkillsFromContent(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];

  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    const allVariants = [canonical, ...aliases];
    for (const variant of allVariants) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      if (regex.test(text)) {
        found.push(canonical);
        break;
      }
    }
  }

  return found;
}
