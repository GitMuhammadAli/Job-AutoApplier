/**
 * Smoke tests — catch the kind of "works locally, broken on prod" bugs that
 * silently slipped through this session (the Vercel-only Chromium PDF crash
 * being the headline example).
 *
 * Coverage philosophy: not full E2E. Three tests that exercise the highest-
 * traffic critical paths end-to-end. If these pass, the app is functionally
 * alive. If they fail, prod is broken and you stop everything else.
 *
 *   1. Auth — sign-in page loads + a sign-in button is present.
 *   2. Recommended — page renders without 500/crashing (auth-gated routes
 *      redirect to /login, which is fine — we just want the route to not
 *      throw).
 *   3. PDF route — /api/resumes/generations/[id]/pdf rejects unauthenticated
 *      requests with 401 (catches the "route is mounted at all" smoke signal
 *      — a 404 here would mean the route file got deleted or has a syntax
 *      error that broke the manifest).
 *
 * Run locally:
 *     npm run dev          # in one terminal
 *     npm run test:e2e     # in another
 *
 * Run in CI: the workflow runs `next build && next start &` then `npm run
 * test:e2e` after the server is reachable on :3000.
 *
 * What this does NOT cover (deliberate):
 *   - Authenticated flows (Tailor & Apply, Send) — needs a seeded test user
 *     with valid OAuth or admin credentials. Set up later with a separate
 *     test:e2e:auth script.
 *   - DB writes — same reason. We don't want smoke tests dirtying prod DB,
 *     and a separate test DB is more setup than this first pass warrants.
 *   - UI screenshots — Playwright supports it (use: { screenshot: ... } in
 *     playwright.config.ts) but visual diffs need a stable baseline first.
 */

import { test, expect } from "@playwright/test";

test("login page loads and shows sign-in CTA", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.status()).toBeLessThan(400);

  // We don't care which OAuth provider is shown — just that there's
  // SOMETHING the user can click to sign in. If the page renders without
  // a sign-in button, the entire app is dead-locked behind auth and
  // nobody can get in.
  const signInButton = page.getByRole("button", { name: /sign in|google|github/i });
  await expect(signInButton.first()).toBeVisible({ timeout: 5000 });
});

test("/recommended route is reachable (redirects to login if unauthed)", async ({ page }) => {
  const response = await page.goto("/recommended");

  // Either we get a 2xx (the page rendered) OR we land on /login after a
  // redirect. Both are healthy. A 500 / 404 / blank page is a smoke failure.
  expect(response?.status()).toBeLessThan(400);

  // After redirect, we should be on either /login or /recommended itself.
  const url = page.url();
  expect(url).toMatch(/\/(login|recommended)/);
});

test("PDF generation endpoint exists (returns 401 for unauthenticated)", async ({ request }) => {
  // Bug we shipped this session: the PDF route had a duplicate
  // renderPdfFromHtml that didn't handle Vercel Chromium and silently
  // crashed in prod for every user. This test catches the regression
  // where the route file gets deleted or renamed — a 404 here would
  // mean the route is gone entirely. A 401 means it's mounted and
  // gating auth correctly.
  //
  // We can't test successful PDF render without a seeded generation +
  // valid session, but smoke-testing the mount point is the cheap signal
  // that catches "the route disappeared" disasters.
  const fakeId = "00000000-0000-0000-0000-000000000000";
  const response = await request.get(`/api/resumes/generations/${fakeId}/pdf`);

  // 401 = route exists, auth gate fired. 404 would mean the route is
  // gone. 500 would mean something blew up at the auth gate itself.
  expect([401, 403]).toContain(response.status());
});

test("admin route is gated (unauthenticated cannot reach /admin)", async ({ page }) => {
  await page.goto("/admin");
  // Should redirect to login OR show a forbidden page.
  // A 200 with /admin still in the URL would mean the admin gate
  // is broken — that's a critical security regression.
  const url = page.url();
  expect(url).not.toMatch(/\/admin\/?$/);
});
