import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    // Allow override via PLAYWRIGHT_BASE_URL so smoke tests can target
    // a dev server on a non-default port (e.g. when 3000 is already
    // occupied by another local app) or a deployed preview URL.
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    traceOnFirstRetry: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  outputDir: "test-results",
});
