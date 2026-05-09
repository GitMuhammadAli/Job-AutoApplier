import { describe, it, expect } from "vitest";
import { categorizeJob } from "./job-categorizer";

describe("categorizeJob", () => {
  it("returns null for completely empty input", () => {
    expect(categorizeJob("", [], "")).toBeNull();
  });

  it("categorizes obvious frontend roles", () => {
    expect(categorizeJob("Senior React Developer", ["react", "css"], "")).toContain("Frontend");
  });

  it("categorizes obvious backend roles", () => {
    const cat = categorizeJob("Backend Engineer", ["nodejs", "postgresql"], "Build APIs");
    expect(cat).toMatch(/Backend|Full Stack/);
  });

  it("categorizes ML roles", () => {
    expect(
      categorizeJob("Machine Learning Engineer", ["pytorch", "tensorflow"], "Train models"),
    ).toContain("Machine Learning");
  });

  it("categorizes DevOps roles", () => {
    expect(
      categorizeJob("DevOps Engineer", ["kubernetes", "terraform"], "CI/CD pipelines"),
    ).toContain("DevOps");
  });

  it("categorizes iOS roles", () => {
    expect(categorizeJob("iOS Developer", ["swift"], "")).toContain("iOS");
  });

  it("categorizes Android roles", () => {
    expect(categorizeJob("Android Developer", ["kotlin"], "")).toContain("Android");
  });

  it("categorizes cross-platform mobile", () => {
    const cat = categorizeJob("React Native Developer", ["react native"], "");
    expect(cat).toMatch(/Mobile|Frontend/);
  });

  it("categorizes data science roles", () => {
    expect(categorizeJob("Data Scientist", ["python", "pandas"], "Statistical analysis")).toMatch(/Data Science|Data Engineering/);
  });

  it("categorizes data engineering roles", () => {
    expect(
      categorizeJob("Data Engineer", ["airflow", "snowflake"], "ETL pipelines"),
    ).toContain("Data Engineering");
  });

  it("categorizes cybersecurity roles", () => {
    const cat = categorizeJob("Security Engineer", ["pentest"], "vulnerability assessment");
    expect(cat).toContain("Cyber");
  });

  it("categorizes cloud engineering roles", () => {
    expect(
      categorizeJob("Cloud Engineer", ["aws", "gcp"], "cloud infrastructure"),
    ).toMatch(/Cloud|DevOps/);
  });

  it("categorizes QA / testing roles", () => {
    expect(
      categorizeJob("QA Engineer", ["selenium"], "test automation"),
    ).toContain("QA");
  });

  it("categorizes blockchain / web3 roles", () => {
    expect(
      categorizeJob("Web3 Engineer", ["solidity"], "smart contracts"),
    ).toMatch(/Blockchain/);
  });

  it("categorizes game dev roles", () => {
    const cat = categorizeJob("Game Developer", ["unity", "c#"], "game engine");
    expect(cat).toContain("Game");
  });

  it("categorizes UI/UX roles", () => {
    expect(
      categorizeJob("UX Designer", ["figma"], "user research"),
    ).toContain("UI/UX");
  });

  it("title keywords get higher weight than description", () => {
    // Same description, but title is decisive
    const a = categorizeJob("React Developer", [], "general software work");
    expect(a).toContain("Frontend");
  });

  it("returns SAME category for case differences", () => {
    expect(categorizeJob("REACT DEVELOPER", [], "")).toBe(categorizeJob("react developer", [], ""));
  });

  it("descriptions are truncated to 800 chars (doesn't blow up on huge text)", () => {
    const long = "x".repeat(50_000);
    expect(() => categorizeJob("React Dev", [], long)).not.toThrow();
  });

  it("returns null when no keywords match anywhere", () => {
    expect(categorizeJob("Plumber", [], "fix pipes and drains")).toBeNull();
  });
});
