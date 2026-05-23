/**
 * API contract sweep. Hits every GET endpoint as each persona, records:
 *   - status code
 *   - response time
 *   - first 200 chars of body (for sanity, not asserting shape)
 *
 * Skips:
 *   - cron routes (need CRON_SECRET; only fire from Vercel)
 *   - /auth/[...nextauth] (consumed by next-auth internals)
 *   - /webhooks/* (signed requests only)
 *
 * For POST/PUT routes: tested separately in api-sweep-write.mjs (only hits the
 * ones that don't have side effects without explicit setup).
 *
 * Run: BASE=http://localhost:3000 node scripts/api-sweep.mjs
 */

const BASE = process.env.BASE ?? "http://localhost:3000";

const PERSONAS = {
  newbie:    { email: "newbie@demo.com",   session: "47868737ebde03f09037a769696efddf6e2e4ed6200fac489174ba35c85475ff" },
  ali:       { email: "ali@demo.com",      session: "bc75afeb293c25b1d6f07e82f5b4a143f3b705ac81589684fa14f1e53bd58bc7" },
  prepared:  { email: "prepared@demo.com", session: "9b3549bb364634aef5cc43f38830e1049356387297e192094aaddf5d3f3e4ee9" },
};

// GET endpoints worth hitting per-user (auth required).
const GET_ROUTES = [
  "/api/health",
  "/api/version",
  "/api/status",
  "/api/heartbeat",  // actually POST
  "/api/system-health",
  "/api/quota/me",
  "/api/analytics",
  "/api/settings/mode",
  "/api/settings/status",
  "/api/resumes/profile",
  "/api/resumes/generations",
  "/api/resumes/templates",
  "/api/applications/send-stats",
  "/api/push/vapid-key",
];

const ADMIN_GET_ROUTES = [
  "/api/admin/stats",
  "/api/admin/jobs",
  "/api/admin/users",
  "/api/admin/feedback",
  "/api/admin/logs",
  "/api/admin/scrapers",
  "/api/admin/quotas/usage",
];

async function hit(path, persona, method = "GET", body = null) {
  const start = Date.now();
  try {
    const headers = { Cookie: `next-auth.session-token=${persona.session}` };
    if (body) headers["Content-Type"] = "application/json";
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    return {
      path, method, persona: persona.email, status: r.status,
      ms: Date.now() - start,
      sample: text.slice(0, 80).replace(/\s+/g, " "),
    };
  } catch (e) {
    return { path, method, persona: persona.email, status: "ERR", ms: Date.now() - start, sample: String(e).slice(0, 80) };
  }
}

const ROW_PAD = { path: 38, persona: 22, method: 6, status: 6, ms: 6 };
function fmtRow(r) {
  const s = String(r.status);
  const status = s === "200" ? "\x1b[32m200\x1b[0m" : s === "401" || s === "403" ? "\x1b[33m" + s + "\x1b[0m" : s.startsWith("4") ? "\x1b[31m" + s + "\x1b[0m" : "\x1b[31m" + s + "\x1b[0m";
  return [
    r.path.padEnd(ROW_PAD.path),
    r.persona.padEnd(ROW_PAD.persona),
    r.method.padEnd(ROW_PAD.method),
    status.padEnd(ROW_PAD.status + 9),
    String(r.ms).padStart(ROW_PAD.ms),
    r.sample,
  ].join(" ");
}

async function main() {
  const results = [];
  console.log("=== GET routes per persona ===");
  for (const path of GET_ROUTES) {
    for (const [name, persona] of Object.entries(PERSONAS)) {
      results.push(await hit(path, persona));
    }
  }
  console.log("=== Admin routes per persona (only admin should get 200) ===");
  for (const path of ADMIN_GET_ROUTES) {
    for (const [name, persona] of Object.entries(PERSONAS)) {
      results.push(await hit(path, persona));
    }
  }

  console.log("\n" + "path".padEnd(ROW_PAD.path) + " " +
    "persona".padEnd(ROW_PAD.persona) + " " +
    "method".padEnd(ROW_PAD.method) + " " +
    "status".padEnd(ROW_PAD.status) + " " +
    "ms".padStart(ROW_PAD.ms) + " sample");
  console.log("-".repeat(140));
  for (const r of results) console.log(fmtRow(r));

  const failures = results.filter((r) => {
    if (r.status === "ERR") return true;
    if (r.status === 200) return false;
    // Admin routes: 401/403 from non-admin is correct, only 5xx is failure
    if (r.path.startsWith("/api/admin")) return r.status >= 500;
    return r.status >= 500;
  });
  console.log(`\n${results.length} hits · ${failures.length} 5xx/error failures`);
  if (failures.length) {
    console.log("\n--- 5xx / ERR ---");
    for (const f of failures) console.log(`${f.path} (${f.persona}): ${f.status} — ${f.sample}`);
  }
  process.exit(failures.length > 0 ? 1 : 0);
}

main();
