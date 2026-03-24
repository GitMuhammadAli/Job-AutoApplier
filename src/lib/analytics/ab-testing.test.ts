import { describe, it, expect } from "vitest";
import { pickVariant, analyzeABResults } from "./ab-testing";

describe("pickVariant", () => {
  it("returns either A or B", () => {
    const result = pickVariant({ variantA: "Subject A", variantB: "Subject B" });
    expect(["A", "B"]).toContain(result.variant);
  });

  it("returns variantA subject when variant is A", () => {
    // Run enough trials to be certain both branches are exercised
    const trials = Array.from({ length: 100 }, () =>
      pickVariant({ variantA: "Subject A", variantB: "Subject B" }),
    );
    for (const result of trials) {
      if (result.variant === "A") {
        expect(result.subject).toBe("Subject A");
      } else {
        expect(result.subject).toBe("Subject B");
      }
    }
  });

  it("subject always corresponds to selected variant", () => {
    const variants = { variantA: "Skill-focused subject", variantB: "Value-focused subject" };
    for (let i = 0; i < 20; i++) {
      const result = pickVariant(variants);
      const expected = result.variant === "A" ? variants.variantA : variants.variantB;
      expect(result.subject).toBe(expected);
    }
  });
});

describe("analyzeABResults", () => {
  it("correctly calculates open rates", () => {
    const results = [
      { variant: "A" as const, opened: true, replied: false },
      { variant: "A" as const, opened: false, replied: false },
      { variant: "B" as const, opened: true, replied: true },
      { variant: "B" as const, opened: true, replied: false },
    ];
    const analysis = analyzeABResults(results);
    expect(analysis.variantA.openRate).toBe(50);
    expect(analysis.variantB.openRate).toBe(100);
  });

  it("correctly identifies the winner", () => {
    const results = [
      { variant: "A" as const, opened: true, replied: false },
      { variant: "A" as const, opened: false, replied: false },
      { variant: "B" as const, opened: true, replied: true },
      { variant: "B" as const, opened: true, replied: false },
    ];
    const analysis = analyzeABResults(results);
    expect(analysis.winner).toBe("B");
  });

  it("is not significant with fewer than 30 results per variant", () => {
    const results = [
      { variant: "A" as const, opened: true, replied: false },
      { variant: "A" as const, opened: false, replied: false },
      { variant: "B" as const, opened: true, replied: true },
      { variant: "B" as const, opened: true, replied: false },
    ];
    const analysis = analyzeABResults(results);
    expect(analysis.significant).toBe(false);
  });

  it("reports significance when 30+ samples per variant", () => {
    const results = Array.from({ length: 60 }, (_, i) => ({
      variant: (i < 30 ? "A" : "B") as "A" | "B",
      opened: i < 30 ? i % 2 === 0 : true,
      replied: false,
    }));
    const analysis = analyzeABResults(results);
    expect(analysis.significant).toBe(true);
  });

  it("correctly calculates reply rates", () => {
    const results = [
      { variant: "A" as const, opened: true, replied: true },
      { variant: "A" as const, opened: true, replied: false },
      { variant: "A" as const, opened: false, replied: false },
      { variant: "A" as const, opened: false, replied: false },
      { variant: "B" as const, opened: true, replied: true },
      { variant: "B" as const, opened: true, replied: true },
    ];
    const analysis = analyzeABResults(results);
    expect(analysis.variantA.replyRate).toBe(25); // 1 of 4
    expect(analysis.variantB.replyRate).toBe(100); // 2 of 2
  });

  it("counts results correctly for each variant", () => {
    const results = [
      { variant: "A" as const, opened: true, replied: false },
      { variant: "A" as const, opened: false, replied: false },
      { variant: "A" as const, opened: false, replied: false },
      { variant: "B" as const, opened: true, replied: false },
    ];
    const analysis = analyzeABResults(results);
    expect(analysis.variantA.count).toBe(3);
    expect(analysis.variantB.count).toBe(1);
  });

  it("returns tie when open rates are equal", () => {
    const results = [
      { variant: "A" as const, opened: true, replied: false },
      { variant: "B" as const, opened: true, replied: false },
    ];
    const analysis = analyzeABResults(results);
    expect(analysis.winner).toBe("tie");
  });

  it("handles empty results without throwing", () => {
    const analysis = analyzeABResults([]);
    expect(analysis.variantA.count).toBe(0);
    expect(analysis.variantB.count).toBe(0);
    expect(analysis.winner).toBe("tie");
    expect(analysis.significant).toBe(false);
  });

  it("returns A as winner when variant A has higher open rate", () => {
    const results = [
      { variant: "A" as const, opened: true, replied: false },
      { variant: "A" as const, opened: true, replied: false },
      { variant: "B" as const, opened: false, replied: false },
      { variant: "B" as const, opened: false, replied: false },
    ];
    const analysis = analyzeABResults(results);
    expect(analysis.winner).toBe("A");
  });
});
