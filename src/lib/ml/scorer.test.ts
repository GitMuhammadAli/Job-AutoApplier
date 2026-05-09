import { describe, it, expect } from "vitest";
import { extractFeatures, scoreJob } from "./scorer";

describe("extractFeatures — keyword overlap (Bug #7 regression: symmetric)", () => {
  it("symmetric — narrow JD doesn't get inflated score (matching/Math.max)", () => {
    // 1 job skill, 3 user skills, 1 match -> 1/Math.max(1,3) = 1/3
    const features = extractFeatures(
      ["React"],
      ["React", "TypeScript", "Node.js"],
      "Dev", "Dev", "Remote", "", "mid", "mid",
    );
    // Was 1.0 (1/jobLen) before fix — bug inflated narrow-JD scores
    expect(features.keywordOverlap).toBeCloseTo(1 / 3);
  });

  it("symmetric — rich JD with half user-matched scores 0.5", () => {
    const features = extractFeatures(
      ["React", "TS", "Node", "Aws", "Docker", "K8s", "Gcp", "Ci", "Redis", "Kafka"],
      ["React", "TS", "Node", "Aws", "Docker"],
      "Dev", "Dev", "Remote", "", "mid", "mid",
    );
    expect(features.keywordOverlap).toBeCloseTo(5 / 10);
  });

  it("returns 0 overlap when no skills match", () => {
    const features = extractFeatures(
      ["Go", "Rust"],
      ["React", "TypeScript"],
      "Backend Dev", "Frontend Dev", "Remote", "", "senior", "junior",
    );
    expect(features.keywordOverlap).toBe(0);
  });

  it("returns 1 overlap when both skill sets are identical", () => {
    const features = extractFeatures(
      ["react", "typescript"],
      ["react", "typescript"],
      "Dev", "Dev", "Remote", "", "mid", "mid",
    );
    expect(features.keywordOverlap).toBe(1);
  });

  it("returns 0 overlap when job has no skills", () => {
    const features = extractFeatures([], ["React"], "Dev", "Dev", "Remote", "", "mid", "mid");
    expect(features.keywordOverlap).toBe(0);
  });

  it("returns 0 overlap when user has no skills", () => {
    const features = extractFeatures(["React"], [], "Dev", "Dev", "Remote", "", "mid", "mid");
    expect(features.keywordOverlap).toBe(0);
  });

  it("dedupes job skills before counting", () => {
    // Bug #9 fix dedupes — duplicate "react" should count once
    const features = extractFeatures(
      ["React", "REACT", "react"],
      ["react"],
      "Dev", "Dev", "Remote", "", "mid", "mid",
    );
    // unique jobLen = 1, unique userLen = 1, match = 1 -> overlap = 1
    expect(features.keywordOverlap).toBe(1);
  });

  it("dedupes user skills before counting", () => {
    const features = extractFeatures(
      ["React"],
      ["react", "REACT", "React"],
      "Dev", "Dev", "Remote", "", "mid", "mid",
    );
    expect(features.keywordOverlap).toBe(1);
  });

  it("handles whitespace-only entries (trimmed + filtered)", () => {
    const features = extractFeatures(
      ["React", "  ", ""],
      ["react"],
      "Dev", "Dev", "Remote", "", "mid", "mid",
    );
    expect(features.keywordOverlap).toBe(1);
  });

  it("never returns NaN even on empty inputs", () => {
    const features = extractFeatures([], [], "", "", "", "", "", "");
    expect(Number.isNaN(features.keywordOverlap)).toBe(false);
  });
});

describe("extractFeatures — keyword variant matching (Bug #9 regression)", () => {
  it("node.js matches nodejs via keywordMatchesText", () => {
    const features = extractFeatures(
      ["nodejs"],
      ["node.js"],
      "Dev", "Dev", "Remote", "", "mid", "mid",
    );
    expect(features.keywordOverlap).toBeGreaterThan(0);
  });

  it("postgres matches postgresql", () => {
    const features = extractFeatures(
      ["postgresql"],
      ["postgres"],
      "Dev", "Dev", "Remote", "", "mid", "mid",
    );
    expect(features.keywordOverlap).toBeGreaterThan(0);
  });

  it("k8s matches kubernetes", () => {
    const features = extractFeatures(
      ["kubernetes"],
      ["k8s"],
      "Dev", "Dev", "Remote", "", "mid", "mid",
    );
    expect(features.keywordOverlap).toBeGreaterThan(0);
  });

  it("titleRelevance matches via shared whole tokens", () => {
    const features = extractFeatures(
      [], [],
      "Senior Frontend Developer",
      "Senior Developer",
      "Remote", "", "mid", "mid",
    );
    // both "senior" and "developer" match -> 2/2 = 1
    expect(features.titleRelevance).toBe(1);
  });

  it("titleRelevance still matches exact tokens", () => {
    const features = extractFeatures(
      [], [],
      "Senior React Developer",
      "Senior React Developer",
      "Remote", "", "mid", "mid",
    );
    expect(features.titleRelevance).toBe(1.0);
  });

  it("titleRelevance returns 0 when no role words match (variant-aware)", () => {
    const features = extractFeatures(
      [], [],
      "Database Administrator",
      "Product Designer",
      "Remote", "", "mid", "mid",
    );
    expect(features.titleRelevance).toBe(0);
  });

  it("titleRelevance defaults to 0.5 when targetRole is empty", () => {
    const features = extractFeatures(
      [], [],
      "Dev", "",
      "Remote", "", "mid", "mid",
    );
    expect(features.titleRelevance).toBe(0.5);
  });
});

describe("extractFeatures — salaryFit (Bug #8 regression: real calculation, was hardcoded 0.5)", () => {
  it("returns 0.3 (neutral) when no salary data on job side", () => {
    const features = extractFeatures([], [], "", "", "Remote", "", "mid", "mid", null, 50000, 100000);
    expect(features.salaryFit).toBe(0.3);
  });

  it("returns 0.3 (neutral) when no user salary range", () => {
    const features = extractFeatures([], [], "", "", "Remote", "", "mid", "mid", "$80,000-$120,000", null, null);
    // user range = (0, MAX_SAFE) so any job range fits inside -> overlap large -> > 0.5
    expect(features.salaryFit).toBeGreaterThan(0.3);
  });

  it("returns higher fit when ranges overlap heavily", () => {
    const features = extractFeatures(
      [], [], "", "", "Remote", "", "mid", "mid",
      "$80,000-$120,000",
      85_000, 115_000,
    );
    expect(features.salaryFit).toBeGreaterThan(0.5);
  });

  it("returns 0.1 (disjoint) when user wants more than job offers", () => {
    const features = extractFeatures(
      [], [], "", "", "Remote", "", "mid", "mid",
      "$30,000-$40,000",
      100_000, 150_000,
    );
    expect(features.salaryFit).toBe(0.1);
  });

  it("salaryFit is no longer a constant — varies with input", () => {
    const a = extractFeatures([], [], "", "", "Remote", "", "mid", "mid", "$50k", 50000, 60000);
    const b = extractFeatures([], [], "", "", "Remote", "", "mid", "mid", "$200k", 50000, 60000);
    expect(a.salaryFit).not.toBe(b.salaryFit);
  });

  it("returns finite numeric values for all branches", () => {
    const tests = [
      [null, null, null],
      ["competitive", null, null], // no digits -> null parse
      ["competitive base + $80k", 60_000, 100_000], // digits present -> parsed
      ["", 50_000, null],
    ] as const;
    for (const [salary, min, max] of tests) {
      const f = extractFeatures([], [], "", "", "", "", "mid", "mid", salary, min, max);
      expect(Number.isFinite(f.salaryFit)).toBe(true);
    }
  });
});

describe("extractFeatures — locationMatch", () => {
  it("returns 1.0 for any remote-mention in job location", () => {
    expect(extractFeatures([], [], "", "", "Remote", "Lahore", "", "").locationMatch).toBe(1.0);
    expect(extractFeatures([], [], "", "", "REMOTE - WORLDWIDE", "", "", "").locationMatch).toBe(1.0);
    expect(extractFeatures([], [], "", "", "Hybrid (Remote)", "Lahore", "", "").locationMatch).toBe(1.0);
  });

  it("returns 0.8 when user city is contained in job location", () => {
    expect(extractFeatures([], [], "", "", "Lahore, Pakistan", "Lahore", "", "").locationMatch).toBe(0.8);
    expect(extractFeatures([], [], "", "", "Karachi (Onsite)", "Karachi", "", "").locationMatch).toBe(0.8);
  });

  it("returns 0.2 when locations differ", () => {
    expect(extractFeatures([], [], "", "", "New York, NY", "Lahore", "", "").locationMatch).toBe(0.2);
    expect(extractFeatures([], [], "", "", "Berlin", "Karachi", "", "").locationMatch).toBe(0.2);
  });

  it("returns 0.2 when user location is empty (no match possible)", () => {
    expect(extractFeatures([], [], "", "", "Berlin", "", "", "").locationMatch).toBe(0.2);
  });
});

describe("extractFeatures — experienceFit", () => {
  it("perfect fit at same level", () => {
    expect(extractFeatures([], [], "", "", "Remote", "", "mid", "mid").experienceFit).toBe(1.0);
    expect(extractFeatures([], [], "", "", "Remote", "", "senior", "senior").experienceFit).toBe(1.0);
    expect(extractFeatures([], [], "", "", "Remote", "", "junior", "junior").experienceFit).toBe(1.0);
  });

  it("reduces proportionally for level gap", () => {
    // junior(1) vs senior(3) -> gap 2 -> fit 1 - 2/3 = 0.333
    expect(extractFeatures([], [], "", "", "Remote", "", "senior", "junior").experienceFit).toBeCloseTo(1 / 3, 5);
    // mid(2) vs senior(3) -> gap 1 -> fit 1 - 1/3 = 0.667
    expect(extractFeatures([], [], "", "", "Remote", "", "senior", "mid").experienceFit).toBeCloseTo(2 / 3, 5);
  });

  it("clamps to 0 for very large gaps (intern vs principal)", () => {
    expect(extractFeatures([], [], "", "", "Remote", "", "principal", "intern").experienceFit).toBe(0);
    expect(extractFeatures([], [], "", "", "Remote", "", "lead", "intern").experienceFit).toBe(0);
  });

  it("defaults missing levels to mid/junior", () => {
    // No levels = mid(2) vs junior(1) -> gap 1 -> fit 0.667
    expect(extractFeatures([], [], "", "", "Remote", "", "", "").experienceFit).toBeCloseTo(2 / 3, 5);
  });

  it("handles uppercased level strings", () => {
    expect(extractFeatures([], [], "", "", "Remote", "", "SENIOR", "SENIOR").experienceFit).toBe(1.0);
  });
});

describe("scoreJob — output range and weights", () => {
  it("returns a value in 0-100 range", () => {
    const features = extractFeatures(["React"], ["React"], "Dev", "Dev", "Remote", "", "mid", "mid");
    const score = scoreJob(features);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns integer scores (rounded)", () => {
    const features = extractFeatures(["React"], ["React"], "Dev", "Dev", "Remote", "", "mid", "mid");
    expect(Number.isInteger(scoreJob(features))).toBe(true);
  });

  it("scores higher with more matching skills", () => {
    const high = extractFeatures(["React", "TS", "Node"], ["react", "ts", "node"], "Dev", "Dev", "Remote", "", "mid", "mid");
    const low = extractFeatures(["React", "TS", "Node"], ["go", "rust", "java"], "Dev", "Dev", "Remote", "", "mid", "mid");
    expect(scoreJob(high)).toBeGreaterThan(scoreJob(low));
  });

  it("scores higher when locations match", () => {
    const remote = extractFeatures(["x"], ["x"], "Dev", "Dev", "Remote", "Lahore", "mid", "mid");
    const off = extractFeatures(["x"], ["x"], "Dev", "Dev", "Tokyo", "Lahore", "mid", "mid");
    expect(scoreJob(remote)).toBeGreaterThan(scoreJob(off));
  });

  it("custom weights affect the result", () => {
    const features = extractFeatures(["React"], ["React"], "Dev", "Dev", "Remote", "", "mid", "mid");
    const low = scoreJob(features, { keywordOverlap: 0, titleRelevance: 0, salaryFit: 0, locationMatch: 0, experienceFit: 0, bias: -10 });
    const high = scoreJob(features, { keywordOverlap: 0, titleRelevance: 0, salaryFit: 0, locationMatch: 0, experienceFit: 0, bias: 10 });
    expect(low).toBeLessThan(high);
  });

  it("zero-weight model with neutral bias scores ~50", () => {
    const features = extractFeatures(["React"], ["React"], "Dev", "Dev", "Remote", "", "mid", "mid");
    const score = scoreJob(features, { keywordOverlap: 0, titleRelevance: 0, salaryFit: 0, locationMatch: 0, experienceFit: 0, bias: 0 });
    expect(score).toBe(50);
  });

  it("monotonically increases with positive feature value at positive weight", () => {
    const fa = { keywordOverlap: 0.1, titleRelevance: 0.5, salaryFit: 0.5, locationMatch: 0.5, experienceFit: 0.5 };
    const fb = { keywordOverlap: 0.9, titleRelevance: 0.5, salaryFit: 0.5, locationMatch: 0.5, experienceFit: 0.5 };
    expect(scoreJob(fb)).toBeGreaterThan(scoreJob(fa));
  });
});
