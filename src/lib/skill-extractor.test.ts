import { describe, it, expect } from "vitest";
import { parseResume, extractSkillsFromContent } from "./skill-extractor";

describe("parseResume", () => {
  it("returns empty parsed shape for empty input", () => {
    const r = parseResume("");
    expect(r.skills).toEqual([]);
    expect(r.yearsOfExperience).toBeNull();
    expect(r.educationLevel).toBeNull();
  });

  it("returns empty for very short input", () => {
    expect(parseResume("ab").skills).toEqual([]);
  });

  it("returns ParsedResume shape", () => {
    const r = parseResume("Some real-looking resume text with experience");
    expect(r).toHaveProperty("skills");
    expect(r).toHaveProperty("sections");
    expect(r).toHaveProperty("yearsOfExperience");
    expect(r).toHaveProperty("educationLevel");
  });

  it("sections object always present even for unstructured text", () => {
    const r = parseResume("Just a paragraph of text with React and Node.js");
    expect(r.sections).toMatchObject({
      summary: expect.any(String),
      experience: expect.any(String),
      education: expect.any(String),
      skills: expect.any(String),
      projects: expect.any(String),
      certifications: expect.any(String),
    });
  });

  it("puts whole text into summary when no section headers found", () => {
    const r = parseResume("Just a paragraph with no headers");
    expect(r.sections.summary).toContain("Just a paragraph");
  });

  it("splits sections by 'Experience' header", () => {
    const r = parseResume(
      "John Doe\nSoftware Engineer\n\nExperience\nWorked at Acme as Senior Dev\n\nEducation\nBS Computer Science",
    );
    expect(r.sections.experience).toContain("Acme");
    expect(r.sections.education).toContain("Computer Science");
  });

  it("extracts skills section content when 'Skills' header present", () => {
    const r = parseResume("John Doe\n\nSkills\nReact, TypeScript, Node.js, PostgreSQL");
    expect(r.sections.skills).toContain("React");
    expect(r.sections.skills).toContain("TypeScript");
  });

  it("extracts at least some skills from a typical resume", () => {
    const r = parseResume(
      "John Doe — Senior Software Engineer\n\n" +
      "Skills\nReact, TypeScript, Node.js, PostgreSQL, Docker, AWS\n\n" +
      "Experience\n5 years at Acme working on backend systems",
    );
    expect(r.skills.length).toBeGreaterThan(0);
  });

  it("doesn't crash on resume with weird unicode", () => {
    expect(() => parseResume("Résumé 🚀 Café 中文")).not.toThrow();
  });

  it("doesn't crash on huge input", () => {
    const huge = "x ".repeat(50_000);
    expect(() => parseResume(huge)).not.toThrow();
  });
});

describe("extractSkillsFromContent", () => {
  it("returns empty array for empty text", () => {
    expect(extractSkillsFromContent("")).toEqual([]);
  });

  it("returns empty for very short text", () => {
    expect(extractSkillsFromContent("ab")).toEqual([]);
  });

  it("extracts React from text", () => {
    const skills = extractSkillsFromContent("I work with React and Redux daily");
    expect(skills.map((s) => s.toLowerCase())).toContain("react");
  });

  it("extracts TypeScript from text", () => {
    const skills = extractSkillsFromContent("Built using TypeScript on Node.js");
    expect(skills.map((s) => s.toLowerCase())).toContain("typescript");
  });

  it("returns array of strings", () => {
    const skills = extractSkillsFromContent("React TypeScript Node.js");
    expect(Array.isArray(skills)).toBe(true);
    skills.forEach((s) => expect(typeof s).toBe("string"));
  });

  it("dedupes skills", () => {
    const skills = extractSkillsFromContent("React React React React");
    const reactCount = skills.filter((s) => s.toLowerCase() === "react").length;
    expect(reactCount).toBeLessThanOrEqual(1);
  });

  it("does not match a substring (boundary check — 'reactor' is NOT React)", () => {
    const skills = extractSkillsFromContent("Worked on a nuclear reactor maintenance team");
    expect(skills.map((s) => s.toLowerCase())).not.toContain("react");
  });

  it("returns empty for resume with no recognized tech", () => {
    const skills = extractSkillsFromContent("Started a bakery and sold pastries to locals");
    expect(skills).toEqual([]);
  });

  it("doesn't crash on null skillsSection arg", () => {
    expect(() => extractSkillsFromContent("React", undefined)).not.toThrow();
  });
});
