# QA Audit Report — JobPilot

**Audit Date:** February 21, 2025  
**Scope:** All page components and key client components

---

## 1. Error States

| #   | Severity     | File                                               | Line(s) | Issue                                                                                                                                                                                                                 |
| --- | ------------ | -------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **CRITICAL** | `src/app/(dashboard)/dashboard/page.tsx`           | 15-19   | When `getJobs`/`getSettings` fail, `settings` is `null`. The page then shows `OnboardingWizard` because of `!settings`. Users who already completed onboarding will see the wizard again instead of an error message. |
| 2   | **HIGH**     | `src/app/(dashboard)/applications/page.tsx`        | 21-23   | On API failure, page renders with empty `applications` and default counts. No error UI or retry option. User sees empty queue with no explanation.                                                                    |
| 3   | **HIGH**     | `src/app/(dashboard)/resumes/page.tsx`             | 10-14   | On `getResumesWithStats` failure, page renders with empty list. No error message or retry.                                                                                                                            |
| 4   | **HIGH**     | `src/app/(dashboard)/templates/page.tsx`           | 10-19   | On failure, page renders with empty `templates` array. No error UI.                                                                                                                                                   |
| 5   | **MEDIUM**   | `src/components/applications/ApplicationQueue.tsx` | 85-97   | `handleSend`: Calls `res.json()` before checking `res.ok`. If server returns non-JSON (e.g. HTML error page on 500), `res.json()` throws and user sees generic "Network error" instead of the actual error message.   |
| 6   | **MEDIUM**   | `src/components/applications/ApplicationQueue.tsx` | 300-314 | `handleBulkSend`: Same pattern — `res.json()` may throw on non-JSON response.                                                                                                                                         |
| 7   | **LOW**      | `src/app/(dashboard)/jobs/[id]/page.tsx`           | 35-37   | DB error results in `notFound()` (404). User sees "page not found" instead of a retryable error state.                                                                                                                |

---

## 2. Loading States

| #   | Severity   | File                                          | Line(s) | Issue                                                                                                                                      |
| --- | ---------- | --------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 8   | **MEDIUM** | `src/app/(dashboard)/dashboard/page.tsx`      | —       | Server component with no Suspense boundary. During RSC fetch, user may see blank/loading shell. Consider adding `loading.tsx` or Suspense. |
| 9   | **MEDIUM** | `src/app/(dashboard)/analytics/page.tsx`      | —       | Same — no loading.tsx for analytics data fetch.                                                                                            |
| 10  | **LOW**    | `src/components/templates/TemplateEditor.tsx` | 375     | Create button shows "Creating..." when `saving` but no Loader2 spinner. Inconsistent with other forms.                                     |

---

## 3. Empty States

| #   | Severity   | File                                          | Line(s) | Issue                                                                                                                                                               |
| --- | ---------- | --------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | **MEDIUM** | `src/components/templates/TemplateEditor.tsx` | 177-302 | When `templates.length === 0`, renders empty grid with only "Create New" button. No friendly empty state message or CTA explaining what templates are for.          |
| 12  | **LOW**    | `src/app/(dashboard)/applications/page.tsx`   | —       | When `applications` is empty due to error (not real empty), `ApplicationQueue` shows "No applications in this tab" — could be confused with legitimate empty state. |

---

## 4. Auth

| #   | Severity | File                             | Line(s) | Issue                                                                                         |
| --- | -------- | -------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| 13  | **OK**   | `src/app/(dashboard)/layout.tsx` | 14-21   | Auth is correctly enforced: `getAuthSession()` and redirect to `/login` when unauthenticated. |
| 14  | **OK**   | `src/app/(landing)/page.tsx`     | 41-43   | Authenticated users redirected to `/dashboard`.                                               |

---

## 5. Unhandled Promise Rejections / Error Handling

| #   | Severity     | File                                      | Line(s) | Issue                                                                                                                                                                                                                                                                                             |
| --- | ------------ | ----------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | **CRITICAL** | `src/app/login/LoginForm.tsx`             | 41-48   | `handleEmail`: `signIn("email", { email, redirect: false })` returns `{ ok, error, url }` — does NOT throw. Code never checks return value. On failure (e.g. invalid email, provider error), still sets `emailSent=true` and shows "Check your inbox". User thinks email was sent when it wasn't. |
| 16  | **LOW**      | `src/components/layout/Header.tsx`        | 20-26   | Fetch to `/api/settings/mode` uses `.catch(() => {})` — errors are silently swallowed. Account status may never show.                                                                                                                                                                             |
| 17  | **LOW**      | `src/components/jobs/QuickApplyPanel.tsx` | 97-111  | Two fetches use `.catch(() => {})` — silent failure. Application mode and send stats may not load.                                                                                                                                                                                                |

---

## 6. Memory Leaks

| #   | Severity | File                                               | Line(s) | Issue                                                                     |
| --- | -------- | -------------------------------------------------- | ------- | ------------------------------------------------------------------------- |
| 18  | **OK**   | `src/components/applications/SendingStatusBar.tsx` | 35-44   | `useEffect` with `setInterval` correctly returns `clearInterval` cleanup. |
| 19  | **OK**   | `src/components/dashboard/StatusBanner.tsx`        | 38-43   | Same — interval cleaned up.                                               |
| 20  | **OK**   | `src/components/analytics/Charts.tsx`              | 24-34   | `MutationObserver` correctly disconnected in cleanup.                     |

---

## 7. Dark Mode

| #   | Severity   | File                                               | Line(s)      | Issue                                                                                                                                                                              |
| --- | ---------- | -------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21  | **MEDIUM** | `src/app/(dashboard)/system-health/page.tsx`       | 118-122, 216 | `StatBox` uses hardcoded `color` prop: `text-emerald-600`, `text-blue-600`, `text-red-600`, `text-amber-600`. No `dark:` variants. May be too bright or low-contrast in dark mode. |
| 22  | **MEDIUM** | `src/components/applications/SendingStatusBar.tsx` | 76-78        | Normal/warning container: `bg-amber-50 ring-amber-200/60` and `bg-slate-50 ring-slate-200/60` — no `dark:` variants.                                                               |
| 23  | **MEDIUM** | `src/components/applications/SendingStatusBar.tsx` | 81-94        | `text-slate-500`, `text-slate-700` — missing `dark:text-zinc-*` for readability.                                                                                                   |
| 24  | **LOW**    | `src/components/templates/TemplateEditor.tsx`      | 308          | CreateTemplateDialog Subject label: `text-slate-600` — missing `dark:text-zinc-400`.                                                                                               |
| 25  | **LOW**    | `src/components/resumes/ResumeList.tsx`            | 262          | Loading text: `text-blue-600` — no dark variant.                                                                                                                                   |
| 26  | **LOW**    | `src/components/kanban/JobCard.tsx`                | 168-172      | Match score bar: `bg-emerald-500` and `bg-amber-400` for high/medium — no dark variants (low has `dark:bg-zinc-600`).                                                              |

---

## 8. Responsive / Overflow

| #   | Severity   | File                                               | Line(s) | Issue                                                                                                                                                                       |
| --- | ---------- | -------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 27  | **MEDIUM** | `src/components/applications/ApplicationQueue.tsx` | 357-388 | `TabsList` with 6 tabs (All, Draft, Ready, Sent, Failed, Bounced) may overflow on narrow mobile. `flex flex-wrap` helps but badges and text can still cause cramped layout. |
| 28  | **LOW**    | `src/components/settings/SettingsForm.tsx`         | 756     | Mode comparison table has `overflow-x-auto -mx-5 px-5` — good. On very small screens, table may still be hard to read.                                                      |
| 29  | **LOW**    | `src/components/kanban/JobCard.tsx`                | 86-94   | Card uses `truncate` for company/title. Long text in badges (e.g. "This week") could cause wrap on very narrow cards.                                                       |

---

## 9. Additional Issues

| #   | Severity | File                                         | Line(s) | Issue                                                                                                                                                                          |
| --- | -------- | -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 30  | **LOW**  | `src/app/(dashboard)/system-health/page.tsx` | 192-213 | `StatusCard` receives `time` prop but the component destructures `timeAgo: ago` and doesn't use `time` in the rendered output (only `message` and `ago`). Unused prop — minor. |
| 31  | **LOW**  | `src/app/(dashboard)/jobs/new/page.tsx`      | —       | Add Job page has no auth check at page level — but it's under dashboard layout which enforces auth. OK.                                                                        |
| 32  | **LOW**  | `src/components/jobs/JobDetailClient.tsx`    | 336     | `navigator.clipboard.writeText(coverLetterText)` — no `catch` if clipboard API fails (e.g. in insecure context). Toast says "Copied" even if it failed.                        |

---

## Summary

| Severity | Count |
| -------- | ----- |
| CRITICAL | 2     |
| HIGH     | 4     |
| MEDIUM   | 11    |
| LOW      | 15    |

**Priority fixes:**

1. **LoginForm** — Check `signIn` return value and show error when `!ok`.
2. **Dashboard** — Distinguish "settings failed to load" from "not onboarded"; show error UI for API failures.
3. **Applications, Resumes, Templates** — Add error fallback UI with retry when data fetch fails.
4. **ApplicationQueue handleSend** — Parse JSON safely; check `res.ok` before assuming JSON.
5. **SendingStatusBar, System Health StatBox** — Add dark mode variants.
