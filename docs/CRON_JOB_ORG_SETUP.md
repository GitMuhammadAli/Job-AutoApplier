# cron-job.org setup — missing schedules

The admin dashboard shows `Send Scheduled`, `Send Queued`, and `Match Jobs`
as **Never ran**. They're not in `vercel.json` (which is intentionally
empty — Vercel Hobby caps crons too tightly). They're triggered by
cron-job.org externally, and these three entries were never added.

Add them at https://console.cron-job.org/jobs:

## Required entries

| Title (label) | URL | Schedule | Method |
|---|---|---|---|
| JobPilot — Send Scheduled | `https://job-auto-applier-three.vercel.app/api/cron/send-scheduled` | Every 5 minutes | GET |
| JobPilot — Send Queued | `https://job-auto-applier-three.vercel.app/api/cron/send-queued` | Every 5 minutes | GET |
| JobPilot — Match Jobs (optional) | `https://job-auto-applier-three.vercel.app/api/cron/match-jobs` | Every 1 hour | GET |

Replace the hostname if your production URL differs — check
`vercel ls` or the Vercel dashboard for the canonical alias.

## Auth header

Each job needs the cron secret. cron-job.org → **Advanced** → **Headers**:

```
Authorization: Bearer <CRON_SECRET>
```

`CRON_SECRET` is the value already in your Vercel project's env vars.
The `verifyCronSecret()` helper in `src/lib/cron-auth.ts` accepts either
that header OR a `?secret=<value>` query parameter — header is preferred
because the query form lands in access logs.

## Why these three need it

- **send-scheduled** drains `JobApplication.scheduledSendAt <= now()` — if
  you draft an application at 9pm and pick "Send at 9am tomorrow", this
  is the cron that flips it from `READY` to `SENT`. Without it, every
  scheduled send stays in queue forever.
- **send-queued** drains the SENDING queue — applications stuck in the
  `SENDING` state get retried. Without it, a transient SMTP failure
  leaves the application stuck.
- **match-jobs** is the per-user matcher. `match-all-users` already runs
  hourly and covers the multi-tenant path, so `match-jobs` is genuinely
  optional — keep it manual-trigger-only if you only have one active user.

## Verification

After adding each one:

1. cron-job.org → the job → **Test run**. Should return `200`.
2. Wait one schedule cycle.
3. Refresh `/admin` — the row should show a real `Last run` timestamp.

If you see `401`, the `Authorization` header didn't make it. cron-job.org
strips trailing whitespace by default; double-check the header value
doesn't have a leading or trailing space.
