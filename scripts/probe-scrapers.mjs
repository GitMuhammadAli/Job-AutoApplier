#!/usr/bin/env node
/**
 * Local probe — hits every scraper upstream with the keys in your .env and
 * reports exactly what each returns. Designed to answer the question
 * "is my key bad, or am I just getting 0 results?" without needing to
 * deploy and read Vercel function logs.
 *
 * Usage:
 *   node scripts/probe-scrapers.mjs                # uses .env.local
 *   ENV_FILE=.env.production.local node scripts/probe-scrapers.mjs
 *
 * Reads:
 *   SERPAPI_KEY      — rozee + google
 *   RAPIDAPI_KEY     — indeed + jsearch
 *   ADZUNA_APP_ID    — adzuna
 *   ADZUNA_APP_KEY   — adzuna
 *
 * Per-upstream output is one of:
 *   OK <count>     — keys good, returned <count> results
 *   AUTH FAIL      — 401/403 (bad/expired key)
 *   QUOTA          — 429 / explicit quota error in body
 *   EMPTY          — 200 but no results (query niche or wrong filter)
 *   NETWORK <msg>  — transport failure
 *   MISSING_KEY    — env var not set
 *
 * Exit code 0 = probe ran. Non-zero = the probe itself crashed.
 */

import fs from "node:fs";
import path from "node:path";

const envFile = process.env.ENV_FILE || ".env.local";
const envPath = path.resolve(process.cwd(), envFile);
if (fs.existsSync(envPath)) {
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (!(k in process.env)) {
      process.env[k] = v.replace(/^["']|["']$/g, "");
    }
  }
}

const ROW = (name, status, detail = "") =>
  console.log(`  ${name.padEnd(14)} ${status.padEnd(14)} ${detail}`);

function classify(httpStatus, body) {
  if (httpStatus === 401 || httpStatus === 403) return "AUTH FAIL";
  if (httpStatus === 429) return "QUOTA";
  if (typeof body === "object" && body) {
    const lowerErr = String(body.error ?? body.message ?? "").toLowerCase();
    if (/key|auth|forbidden/i.test(lowerErr)) return "AUTH FAIL";
    if (/quota|rate|limit/i.test(lowerErr)) return "QUOTA";
  }
  return null;
}

async function probeSerpApi(label, chips) {
  const key = process.env.SERPAPI_KEY;
  if (!key) return ROW(label, "MISSING_KEY", "SERPAPI_KEY not set");
  const q = encodeURIComponent("software engineer jobs Pakistan");
  const url = `https://serpapi.com/search.json?engine=google_jobs&q=${q}&chips=${chips}&api_key=${key}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const body = await res.json().catch(() => ({}));
    const cls = classify(res.status, body);
    if (cls) return ROW(label, cls, `http=${res.status} err=${body.error ?? "-"}`);
    if (!res.ok) return ROW(label, `HTTP_${res.status}`, JSON.stringify(body).slice(0, 80));
    const count = (body.jobs_results ?? []).length;
    return ROW(label, count > 0 ? "OK" : "EMPTY", `count=${count} status=${body.search_metadata?.status ?? "?"}`);
  } catch (err) {
    return ROW(label, "NETWORK", err.message ?? String(err));
  }
}

async function probeRapidApi(label, q) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return ROW(label, "MISSING_KEY", "RAPIDAPI_KEY not set");
  const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q)}&page=1&num_pages=1`;
  try {
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    const cls = classify(res.status, body);
    if (cls) return ROW(label, cls, `http=${res.status} msg=${body.message ?? "-"}`);
    if (!res.ok) return ROW(label, `HTTP_${res.status}`, JSON.stringify(body).slice(0, 80));
    const count = (body.data ?? []).length;
    return ROW(label, count > 0 ? "OK" : "EMPTY", `count=${count}`);
  } catch (err) {
    return ROW(label, "NETWORK", err.message ?? String(err));
  }
}

async function probeAdzuna(label, country) {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) {
    return ROW(label, "MISSING_KEY", `ADZUNA_APP_ID=${!!id} ADZUNA_APP_KEY=${!!key}`);
  }
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${id}&app_key=${key}&what=engineer&results_per_page=10&max_days_old=14`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const body = await res.json().catch(() => ({}));
    const cls = classify(res.status, body);
    if (cls) return ROW(label, cls, `http=${res.status}`);
    if (!res.ok) return ROW(label, `HTTP_${res.status}`, JSON.stringify(body).slice(0, 80));
    const count = (body.results ?? []).length;
    return ROW(label, count > 0 ? "OK" : "EMPTY", `count=${count} total_available=${body.count ?? "?"}`);
  } catch (err) {
    return ROW(label, "NETWORK", err.message ?? String(err));
  }
}

console.log(`\nProbing scraper upstreams using ${envFile}\n`);
console.log("  upstream       status         detail");
console.log("  " + "─".repeat(60));

await probeSerpApi("rozee", "date_posted:month");
await probeSerpApi("google_jobs", "date_posted:today");
await probeRapidApi("jsearch", "software engineer");
await probeRapidApi("indeed-via-rapidapi", "software engineer Pakistan");
await probeAdzuna("adzuna(us)", "us");
await probeAdzuna("adzuna(pk)", "pk");

console.log(`
Interpretation:
  AUTH FAIL    Key is bad/expired/revoked. Rotate in the provider console
               and update Vercel env. Then redeploy.
  QUOTA        Burnt for the current window. Either wait, upgrade tier, or
               configure the scraper to skip via env (e.g. drop SERPAPI_KEY
               temporarily).
  EMPTY        Key works, but the query returned nothing. Either your
               keyword set is too niche for what the source indexes, or
               the filter (date range / country) is too tight.
  OK           No action needed.
  MISSING_KEY  Set the env var locally + in Vercel.
`);
