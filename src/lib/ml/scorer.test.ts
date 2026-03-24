import { describe, it, expect } from "vitest";
import { extractFeatures, scoreJob } from "./scorer";

describe("extractFeatures", () => {
  it("calculates keyword overlap correctly", () => {
    // jobSkills has 3; userSkills matches 2 of them (react, typescript)
    const features = extractFeatures(
      ["React", "TypeScript", "Node.js"],
      ["react", "typescript", "python"],
      "Frontend Developer",
      "Frontend Developer",
      "Remote",
      "Lahore",
      "mid",
      "junior",
    );
    expect(features.keywordOverlap).toBeCloseTo(2 / 3); // 2 of 3 job skills matched
  });

  it("returns 0 overlap when no skills match", () => {
    const features = extractFeatures(
      ["Go", "Rust"],
      ["React", "TypeScript"],
      "Backend Dev",
      "Frontend Dev",
      "Remote",
      "",
      "senior",
      "junior",
    );
    expect(features.keywordOverlap).toBe(0);
  });

  it("returns 1 overlap when all job skills are matched", () => {
    const features = extractFeatures(
      ["react", "typescript"],
      ["React", "TypeScript", "Node.js"],
      "Dev",
      "Dev",
      "Remote",
      "",
      "mid",
      "mid",
    );
    expect(features.keywordOverlap).toBe(1);
  });

  it("returns 0 overlap when job has no skills", () => {
    const features = extractFeatures([], ["React", "TypeScript"], "Dev", "Dev", "Remote", "", "mid", "mid");
    expect(features.keywordOverlap).toBe(0);
  });

  it("gives full location match for remote jobs", () => {
    const features = extractFeatures([], [], "", "", "Remote - Anywhere", "Lahore", "", "");
    expect(features.locationMatch).toBe(1.0);
  });

  it("gives 0.8 location match when job city matches user city", () => {
    const features = extractFeatures([], [], "", "", "Lahore, Pakistan", "Lahore", "", "");
    expect(features.locationMatch).toBe(0.8);
  });

  it("gives low location match for different cities", () => {
    const features = extractFeatures([], [], "", "", "New York, NY", "Lahore", "", "");
    expect(features.locationMatch).toBe(0.2);
  });

  it("calculates title relevance as full match when titles are identical", () => {
    const features = extractFeatures([], [], "Senior React Developer", "Senior React Developer", "Remote", "", "mid", "mid");
    expect(features.titleRelevance).toBe(1.0);
  });

  it("calculates title relevance as 0 when no words overlap", () => {
    const features = extractFeatures([], [], "Backend Engineer", "Product Designer", "Remote", "", "mid", "mid");
    expect(features.titleRelevance).toBe(0);
  });

  it("calculates perfect experience fit when levels match exactly", () => {
    const features = extractFeatures([], [], "", "", "Remote", "", "mid", "mid");
    expect(features.experienceFit).toBe(1.0);
  });

  it("reduces experience fit proportionally for level gap", () => {
    // junior(1) vs senior(3) => gap of 2, fit = 1 - 2/3 ≈ 0.333
    const features = extractFeatures([], [], "", "", "Remote", "", "senior", "junior");
    expect(features.experienceFit).toBeCloseTo(1 / 3, 5);
  });

  it("clamps experience fit to 0 for very large gaps", () => {
    // intern(0) vs principal(5) => gap 5, min(5/3,1)=1, fit=0
    const features = extractFeatures([], [], "", "", "Remote", "", "principal", "intern");
    expect(features.experienceFit).toBe(0);
  });

  it("defaults salary fit to 0.5", () => {
    const features = extractFeatures([], [], "", "", "Remote", "", "mid", "mid");
    expect(features.salaryFit).toBe(0.5);
  });
});

describe("scoreJob", () => {
  it("returns a value in 0-100 range", () => {
    const features = extractFeatures(["React"], ["React"], "Dev", "Dev", "Remote", "", "mid", "mid");
    const score = scoreJob(features);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("scores higher with more matching skills", () => {
    const highMatch = extractFeatures(
      ["React", "TS", "Node"],
      ["react", "ts", "node"],
      "Dev",
      "Dev",
      "Remote",
      "",
      "mid",
      "mid",
    );
    const lowMatch = extractFeatures(
      ["React", "TS", "Node"],
      ["go", "rust", "java"],
      "Dev",
      "Dev",
      "Remote",
      "",
      "mid",
      "mid",
    );
    expect(scoreJob(highMatch)).toBeGreaterThan(scoreJob(lowMatch));
  });

  it("returns integer scores (rounded)", () => {
    const features = extractFeatures(["React"], ["React"], "Dev", "Dev", "Remote", "", "mid", "mid");
    const score = scoreJob(features);
    expect(Number.isInteger(score)).toBe(true);
  });

  it("accepts custom weights and scores accordingly", () => {
    const features = extractFeatures(["React"], ["React"], "Dev", "Dev", "Remote", "", "mid", "mid");
    // With extreme bias toward 0 (very negative bias), score should be low
    const lowScore = scoreJob(features, {
      keywordOverlap: 0,
      titleRelevance: 0,
      salaryFit: 0,
      locationMatch: 0,
      experienceFit: 0,
      bias: -10,
    });
    // With extreme bias toward 1 (very positive bias), score should be high
    const highScore = scoreJob(features, {
      keywordOverlap: 0,
      titleRelevance: 0,
      salaryFit: 0,
      locationMatch: 0,
      experienceFit: 0,
      bias: 10,
    });
    expect(lowScore).toBeLessThan(highScore);
  });
});
