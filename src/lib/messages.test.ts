import { describe, it, expect } from "vitest";
import {
  GENERIC, AUTH, VALIDATION, RATE_LIMIT, HEALTH, ADMIN, APPLICATIONS,
  ANALYTICS, EMAIL, EXPORT, JOBS, ONBOARDING, PUSH, RESUMES, SETTINGS,
  TEMPLATES, DASHBOARD, FEEDBACK, WEBHOOKS, CRON, SCRAPER,
} from "./messages";

// Generic non-empty + non-throwing checks across all message buckets.
// These catch accidental deletions/blank entries during refactors.

const buckets = {
  GENERIC, AUTH, VALIDATION, RATE_LIMIT, HEALTH, ADMIN, APPLICATIONS,
  ANALYTICS, EMAIL, EXPORT, JOBS, ONBOARDING, PUSH, RESUMES, SETTINGS,
  TEMPLATES, DASHBOARD, FEEDBACK, WEBHOOKS, CRON, SCRAPER,
} as const;

describe("messages — every bucket is a non-empty object", () => {
  for (const [name, bucket] of Object.entries(buckets)) {
    it(`${name} is a non-null object`, () => {
      expect(bucket).not.toBeNull();
      expect(typeof bucket).toBe("object");
    });

    it(`${name} has at least one entry`, () => {
      expect(Object.keys(bucket).length).toBeGreaterThan(0);
    });

    it(`${name} entries are all non-empty (string OR fn that returns non-empty)`, () => {
      for (const [key, value] of Object.entries(bucket)) {
        if (typeof value === "string") {
          expect(value, `${name}.${key}`).not.toBe("");
        } else if (typeof value === "function") {
          // Function-typed messages must not return empty
          const result = (value as (...args: unknown[]) => string)(
            "x", 1, 2, 3, "y", "z",
          );
          expect(result, `${name}.${key}()`).toBeTruthy();
        }
      }
    });
  }
});

describe("AUTH bucket sanity", () => {
  it("USERNAME_PASSWORD_REQUIRED is set", () => {
    expect(AUTH.USERNAME_PASSWORD_REQUIRED).toBeTruthy();
  });

  it("INVALID_CREDENTIALS is set", () => {
    expect(AUTH.INVALID_CREDENTIALS).toBeTruthy();
  });

  it("ADMIN_CREDENTIALS_NOT_CONFIGURED is set", () => {
    expect(AUTH.ADMIN_CREDENTIALS_NOT_CONFIGURED).toBeTruthy();
  });
});

describe("RATE_LIMIT.PLEASE_WAIT", () => {
  it("returns string mentioning the wait", () => {
    expect(typeof RATE_LIMIT.PLEASE_WAIT(60)).toBe("string");
    expect(RATE_LIMIT.PLEASE_WAIT(60)).toMatch(/60/);
  });

  it("handles 0 seconds", () => {
    expect(typeof RATE_LIMIT.PLEASE_WAIT(0)).toBe("string");
  });

  it("handles large number of seconds", () => {
    expect(typeof RATE_LIMIT.PLEASE_WAIT(3600)).toBe("string");
  });
});
