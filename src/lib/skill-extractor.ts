import { SKILL_ALIASES } from "@/constants/skills";

/**
 * Structured data extracted from a resume's raw text.
 * Used for richer matching and AI email generation.
 */
export interface ParsedResume {
  skills: string[];
  sections: {
    summary: string;
    experience: string;
    education: string;
    skills: string;
    projects: string;
    certifications: string;
  };
  yearsOfExperience: number | null;
  educationLevel: string | null;
}

const SECTION_HEADERS: Record<keyof ParsedResume["sections"], RegExp> = {
  summary: /\b(summary|profile|about\s*me|objective|professional\s*summary|career\s*summary|personal\s*statement)\b/i,
  experience: /\b(experience|work\s*experience|employment|professional\s*experience|work\s*history|career\s*history)\b/i,
  education: /\b(education|academic|qualification|degree|university|college)\b/i,
  skills: /\b(skills|technical\s*skills|core\s*competencies|competencies|technologies|tech\s*stack|tools|expertise|proficiencies)\b/i,
  projects: /\b(projects|personal\s*projects|portfolio|side\s*projects|key\s*projects)\b/i,
  certifications: /\b(certifications?|licenses?|credentials|awards|achievements|honors)\b/i,
};

const EDUCATION_LEVELS: Array<{ pattern: RegExp; level: string }> = [
  { pattern: /\b(ph\.?d|doctorate|doctoral)\b/i, level: "PhD" },
  { pattern: /\b(master|m\.?s\.?c?|m\.?a\.?|mba|m\.?eng)\b/i, level: "Master" },
  { pattern: /\b(bachelor|b\.?s\.?c?|b\.?a\.?|b\.?eng|b\.?tech|undergraduate)\b/i, level: "Bachelor" },
  { pattern: /\b(associate|diploma|a\.?s\.?|a\.?a\.?)\b/i, level: "Associate" },
  { pattern: /\b(certificate|bootcamp|boot\s*camp|nanodegree)\b/i, level: "Certificate" },
];

/**
 * Full pipeline: parse resume text into structured sections, extract skills,
 * detect education level, and estimate years of experience.
 */
export function parseResume(text: string): ParsedResume {
  if (!text || text.trim().length < 10) {
    return {
      skills: [],
      sections: { summary: "", experience: "", education: "", skills: "", projects: "", certifications: "" },
      yearsOfExperience: null,
      educationLevel: null,
    };
  }

  const sections = extractSections(text);
  const skills = extractSkillsFromContent(text, sections.skills);
  const yearsOfExperience = estimateYearsOfExperience(text);
  const educationLevel = detectEducationLevel(sections.education || text);

  return { skills, sections, yearsOfExperience, educationLevel };
}

/**
 * Splits resume text into labeled sections using common header patterns.
 * Falls back gracefully — if no headers found, the whole text goes to "summary".
 */
function extractSections(text: string): ParsedResume["sections"] {
  const result: ParsedResume["sections"] = {
    summary: "", experience: "", education: "",
    skills: "", projects: "", certifications: "",
  };

  const lines = text.split(/\n/);
  const sectionKeys = Object.keys(SECTION_HEADERS) as Array<keyof typeof SECTION_HEADERS>;

  interface SectionMarker { key: keyof ParsedResume["sections"]; lineIndex: number; }
  const markers: SectionMarker[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length > 80 || line.length < 2) continue;

    for (const key of sectionKeys) {
      if (SECTION_HEADERS[key].test(line)) {
        markers.push({ key, lineIndex: i });
        break;
      }
    }
  }

  if (markers.length === 0) {
    result.summary = text;
    return result;
  }

  // Content before first section header → summary
  if (markers[0].lineIndex > 0) {
    result.summary = lines.slice(0, markers[0].lineIndex).join("\n").trim();
  }

  for (let m = 0; m < markers.length; m++) {
    const start = markers[m].lineIndex + 1;
    const end = m + 1 < markers.length ? markers[m + 1].lineIndex : lines.length;
    const content = lines.slice(start, end).join("\n").trim();
    result[markers[m].key] = content;
  }

  return result;
}

function buildSkillPattern(variant: string): RegExp {
  const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startsWord = /^\w/.test(variant) ? "\\b" : "(?<![\\w])";
  const endsWord = /\w$/.test(variant) ? "\\b" : "(?![\\w])";
  return new RegExp(`${startsWord}${escaped}${endsWord}`, "i");
}

/**
 * Extracts skills from resume text.
 * Gives priority to the dedicated "Skills" section if found,
 * but also scans the full text for skills mentioned in context.
 */
export function extractSkillsFromContent(text: string, skillsSection?: string): string[] {
  if (!text || text.trim().length < 10) return [];

  const normalised = normalizeForSkillMatching(text);
  const skillsSectionNorm = skillsSection ? normalizeForSkillMatching(skillsSection) : "";

  const found = new Set<string>();

  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    const allVariants = [canonical, ...aliases];
    for (const variant of allVariants) {
      const pattern = buildSkillPattern(variant);

      // Match in skills section (high confidence)
      if (skillsSectionNorm && pattern.test(skillsSectionNorm)) {
        found.add(canonical);
        break;
      }

      // Match in full text
      if (pattern.test(normalised)) {
        found.add(canonical);
        break;
      }
    }
  }

  // Remove overly generic single-char matches that are likely false positives
  const genericSingleChar = ["C", "R"];
  for (const skill of genericSingleChar) {
    if (found.has(skill) && !skillsSectionNorm) {
      found.delete(skill);
    }
  }

  return Array.from(found).sort();
}

function normalizeForSkillMatching(text: string): string {
  return text
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[•·‣▪–—|►★✓✔■□●○◆◇▸▹➤➜→]/g, " ")
    .replace(/[""'']/g, "'")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .trim();
}

/**
 * Estimates years of experience from resume text by looking for year ranges
 * and date patterns in the experience section.
 */
function estimateYearsOfExperience(text: string): number | null {
  // Pattern: "X+ years" / "X years of experience"
  const explicitMatch = text.match(/(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/i);
  if (explicitMatch) return parseInt(explicitMatch[1]);

  // Look for date ranges like "2019 - 2023", "Jan 2020 - Present"
  const datePattern = /(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(\d{4})\s*[-–—to]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(\d{4}|present|current|now)/gi;

  let minYear = Infinity;
  let maxYear = 0;
  const currentYear = new Date().getFullYear();
  let match: RegExpExecArray | null;

  while ((match = datePattern.exec(text)) !== null) {
    const startYear = parseInt(match[1]);
    const endYear = /present|current|now/i.test(match[2]) ? currentYear : parseInt(match[2]);

    if (startYear >= 1990 && startYear <= currentYear && endYear >= startYear) {
      minYear = Math.min(minYear, startYear);
      maxYear = Math.max(maxYear, endYear);
    }
  }

  if (minYear < Infinity && maxYear > 0) {
    return maxYear - minYear;
  }

  return null;
}

function detectEducationLevel(text: string): string | null {
  for (const { pattern, level } of EDUCATION_LEVELS) {
    if (pattern.test(text)) return level;
  }
  return null;
}
