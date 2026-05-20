# Instant-Apply Performance Audit

> **Status**: Phase 1 partial — paused 2026-05-06. Phase 2 measurement and Phase 3-5 not yet executed.
> **Target**: `/api/cron/instant-apply` self-chain
> **Scope**: Validate / contradict the recent inspection-based changes (`f84d9c5` lock-leak fix + `maxDuration` 10→60s, `3708e43` self-chain across user batches, `18b3fad` errors vs skipped split).
> **Symptom**: durationMs telemetry opaque — unknown if the 60s budget is actually used, per-user breakdown unknown, self-chain depth distribution unknown.
> **Worst when**: Per-unit costs measurable now (~7 users); scale behavior (chain recursion, budget saturation, lock contention) must be modeled or load-simulated.

---

## TL;DR (Phase 1 only)

Two findings already contradict assumptions baked into the recent fixes. Neither was caught by inspection-only review.

1. **The effective budget is 8 seconds, not 60.** `TIMEOUTS.CRON_SOFT_LIMIT_MS = 8_000` ([constants.ts:54](../src/lib/constants.ts#L54)) and the per-user loop hard-breaks at `startTime + 6_000` ([instant-apply/route.ts:130](../src/app/api/cron/instant-apply/route.ts#L130)). The `maxDuration = 60` bump was therefore moot for the user-iteration phase. Either the constant is stale and should be ~50_000, or the maxDuration bump bought nothing for the inner loop and only protects the finalization tail.

2. **`EXISTING_JOB_IDS = 10_000` per user, loaded with a join on every tick.** Each user pulls up to 10k UserJob rows with a `globalJob.title/company` join for dedup ([route.ts:132-140](../src/app/api/cron/instant-apply/route.ts#L132), [constants.ts:19](../src/lib/constants.ts#L19)). At realistic-user scale, this dominates per-user cost (~150ms × N users) and is likely the hidden ceiling on the self-chain math.

---

## Domain classification

1. **BACKEND THROUGHPUT / SCALE** (primary) — cron-driven worker iterating users × jobs in nested loops; bound by per-tick budget × ticks per hour × per-user serial work.
2. **JOB / PIPELINE** (secondary) — long-running batch with serial AI/SMTP calls inside; candidate for fan-out concurrency on the FULL_AUTO path.
3. Minor **BACKEND LATENCY** for the per-user DB roundtrip stack.

---

## Hot-path runtime inventory

| # | Step | file:line | Frequency | Thread/IO | Suspected cost | Reached by default? |
|---|---|---|---|---|---|---|
| 1 | `verifyCronSecret` | [cron-auth.ts:12](../src/lib/cron-auth.ts#L12) | 1×/request | CPU | <1 ms | Yes |
| 2 | `createCronTracker.start` | [cron-tracker.ts](../src/lib/cron-tracker.ts) | 1×/request | DB INSERT | ~30-80 ms | Yes |
| 3 | `isLockHeld("scrape-global")` | [system-lock.ts:38](../src/lib/system-lock.ts#L38) | 1×/request | DB SELECT | ~20-50 ms | Yes |
| 4 | `acquireLock("instant-apply")` | [system-lock.ts:7](../src/lib/system-lock.ts#L7) | 1×/request | DB raw SQL | ~20-50 ms | Yes |
| 5 | **globalJob findMany (500)** | [route.ts:53](../src/app/api/cron/instant-apply/route.ts#L53) | 1×/request | DB roundtrip | ~100-400 ms | Yes |
| 6 | Round-robin by source | [route.ts:59-84](../src/app/api/cron/instant-apply/route.ts#L59) | 1×/request | CPU O(n) | ~1-5 ms | Yes |
| 7 | **userSettings findMany (50)** | [route.ts:94](../src/app/api/cron/instant-apply/route.ts#L94) | 1×/request | DB roundtrip + joins | ~100-300 ms | Yes |
| 8 | `decryptSettingsFields` | [route.ts:116](../src/app/api/cron/instant-apply/route.ts#L116) | × users | CPU + crypto | ~2-10 ms × users | Yes |
| 9 | `resume.findMany` per user | [route.ts:122](../src/app/api/cron/instant-apply/route.ts#L122) | × users | DB roundtrip | ~30-80 ms × users | Yes |
| 10 | **Soft budget break (6s)** | [route.ts:130](../src/app/api/cron/instant-apply/route.ts#L130) | × users | CPU | <1 ms | Yes — **break at 6s** |
| 11 | **userJob findMany (10_000 with join)** | [route.ts:132-136](../src/app/api/cron/instant-apply/route.ts#L132) | × users | DB roundtrip | ~50-300 ms × users | Yes — **at-risk: unbounded** |
| 12 | `existingJobIds` Set + dedup keys | [route.ts:137-140](../src/app/api/cron/instant-apply/route.ts#L137) | × users | CPU + alloc | ~5-30 ms × users | Yes |
| 13 | Settings reads (isFullAuto, isSemiAuto, peakHours) | [route.ts:142-153](../src/app/api/cron/instant-apply/route.ts#L142) | × users | CPU + Intl | <2 ms × users | Yes |
| 14 | `jobApplication.count` (if FULL_AUTO) | [route.ts:158](../src/app/api/cron/instant-apply/route.ts#L158) | × FULL_AUTO users | DB SELECT | ~20-50 ms × FULL_AUTO | Conditional |
| 15 | PER FRESH JOB: `existingJobIds.has` | [route.ts:174](../src/app/api/cron/instant-apply/route.ts#L174) | × users × freshJobs (≤25k) | CPU O(1) | <0.01 ms | Yes |
| 16 | PER FRESH JOB: `isDuplicateByKey` | [route.ts:175](../src/app/api/cron/instant-apply/route.ts#L175) | × users × freshJobs | CPU + regex | ~0.1-0.5 ms | Yes |
| 17 | **PER FRESH JOB: `computeMatchScore`** | [route.ts:178](../src/app/api/cron/instant-apply/route.ts#L178) | × users × freshJobs | CPU (ML) | **UNKNOWN — measure first** | Yes — **always called** |
| 18 | PER MATCH: `userJob.create` | [route.ts:185-193](../src/app/api/cron/instant-apply/route.ts#L185) | × matched | DB INSERT | ~30-60 ms | Yes for matches |
| 19 | `existingJobKeys.add` regex | [route.ts:207-209](../src/app/api/cron/instant-apply/route.ts#L207) | × matched | CPU + 4 regex | ~0.5 ms | Yes |
| 20 | MANUAL early-out / AUTO_DRAFT branch | [route.ts:213-215](../src/app/api/cron/instant-apply/route.ts#L213) | × matched | CPU | <0.1 ms | Yes |
| 21 | `pickBestResume` | [route.ts:217](../src/app/api/cron/instant-apply/route.ts#L217) | × draft-eligible | DB query | ~30-200 ms | Conditional ≥AUTO_DRAFT |
| 22 | `findCompanyEmail` | [route.ts:227](../src/app/api/cron/instant-apply/route.ts#L227) | × matches w/o cached email | DB + heuristic | ~50-300 ms | Conditional |
| 23 | `globalJob.update` (cache email) | [route.ts:236](../src/app/api/cron/instant-apply/route.ts#L236) | × new emails | DB UPDATE | ~30-50 ms | Conditional |
| 24 | **`generateInstantEmail`** | [route.ts:246](../src/app/api/cron/instant-apply/route.ts#L246) | × draft-eligible | **AI ~2-3 s each** | **~2000-3000 ms** | Yes ≥AUTO_DRAFT |
| 25 | `isDuplicateApplication` | [route.ts:277](../src/app/api/cron/instant-apply/route.ts#L277) | × FULL_AUTO + qual | DB query | ~20-50 ms | Conditional |
| 26 | **`checkApplicationQuality`** | [route.ts:289](../src/app/api/cron/instant-apply/route.ts#L289) | × FULL_AUTO sends | **AI ~2-4 s each** | **~2000-4000 ms** | Conditional |
| 27 | `jobApplication.create` | [route.ts:327](../src/app/api/cron/instant-apply/route.ts#L327) | × draft-eligible | DB INSERT | ~30-60 ms | Yes ≥AUTO_DRAFT |
| 28 | `canSendNow` rate-limit | [route.ts:353](../src/app/api/cron/instant-apply/route.ts#L353) | × ready-to-send | DB/Redis | ~10-30 ms | Conditional |
| 29 | **`sendApplication` SMTP** | [route.ts:355](../src/app/api/cron/instant-apply/route.ts#L355) | × eligible auto-sends | **Network 1-3 s** | **~1000-3000 ms** | Conditional |
| 30 | **`setTimeout(userDelayMs)` ≥1s** | [route.ts:360](../src/app/api/cron/instant-apply/route.ts#L360) | × sends | sleep | **≥1000 ms** | Deliberate blocking |
| 31 | `activity.create` | [route.ts:366-373](../src/app/api/cron/instant-apply/route.ts#L366) | × matches | DB INSERT | ~30-50 ms | Yes for matches |
| 32 | Per-user notification (email + push) | [route.ts:384-403](../src/app/api/cron/instant-apply/route.ts#L384) | × users w/ matches | DB + SMTP + push | ~200-1500 ms | Conditional |
| 33 | `globalJob.updateMany` (isFresh:false) | [route.ts:393-398](../src/app/api/cron/instant-apply/route.ts#L393) | 1×/request | DB UPDATE bulk | ~50-200 ms | Yes |
| 34 | `systemLog.create` | [route.ts:405](../src/app/api/cron/instant-apply/route.ts#L405) | 1×/request | DB INSERT | ~30-50 ms | Yes |
| 35 | Self-chain fire-and-forget fetch | [route.ts:423+](../src/app/api/cron/instant-apply/route.ts#L423) | 1×/request if nextCursor | Network | ~10-30 ms | Conditional |
| 36 | `tracker.success` | [route.ts:436](../src/app/api/cron/instant-apply/route.ts#L436) | 1×/request | DB UPDATE | ~30-50 ms | Yes |
| 37 | `releaseLock` (in finally) | [route.ts:444](../src/app/api/cron/instant-apply/route.ts#L444) | 1×/request | DB UPDATE | ~30-50 ms | Yes |

---

## Phase 2 measurement plan (not executed yet)

### What can be measured locally without production
- Pure-function microbenchmark of `computeMatchScore` (step #17) across 1000 realistic triples
- DB query for actual distribution of UserJob rows per user (validates whether 10k cap is theoretical or hit)
- Cost-tree symbolic equation across U = 7 / 50 / 200 / 1000

### What requires production instrumentation
- `console.time(...)` wrappers around steps #5, #7, #9, #11, #17, #24, #26, #29; read from Vercel function logs
- `EXPLAIN ANALYZE` on the userJob query for the highest-application user
- Read last 100 instant-apply runs from `SystemLog` to extract durationMs distribution
- Single-user test mode: trigger with `?cursor=<userId>&batch=1` to measure per-user cost in isolation

---

## To resume this audit

1. Re-read this file
2. Confirm whether the two surprises (S1 + S2) are real / intentional / stale
3. Execute Phase 2 with the harness in `/tmp/instant-apply-perf-bench/`
4. Continue to Phase 3 (root-cause diagnosis), Phase 4 (architecture + fix plan), Phase 5 (write the full report)

Paused per user pivot to a new feature build on 2026-05-06.
