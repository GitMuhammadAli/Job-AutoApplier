/**
 * Cross-cutting checks:
 *   1. Safe POST endpoints — heartbeat (no-op write), recommend-existing (read-only),
 *      coach-bullet (one call to confirm shape, not load-test).
 *   2. IDOR probes — newbie tries to fetch prepared's generation by id, expect 404.
 *   3. Unauthenticated probes — bare requests to protected routes return 401.
 */

const BASE = process.env.BASE ?? "http://localhost:3000";

const NEWBIE = "47868737ebde03f09037a769696efddf6e2e4ed6200fac489174ba35c85475ff";
const ALI    = "bc75afeb293c25b1d6f07e82f5b4a143f3b705ac81589684fa14f1e53bd58bc7";
const PREP   = "9b3549bb364634aef5cc43f38830e1049356387297e192094aaddf5d3f3e4ee9";

async function hit({ path, method = "GET", session = null, body = null, label }) {
  const start = Date.now();
  const headers = {};
  if (session) headers.Cookie = `next-auth.session-token=${session}`;
  if (body) headers["Content-Type"] = "application/json";
  try {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { label, path, method, status: r.status, ms: Date.now() - start, body: (await r.text()).slice(0, 120) };
  } catch (e) {
    return { label, path, method, status: "ERR", ms: Date.now() - start, body: String(e).slice(0, 120) };
  }
}

function colorStatus(s) {
  const str = String(s);
  if (str === "200") return "\x1b[32m200\x1b[0m";
  if (str === "201") return "\x1b[32m201\x1b[0m";
  if (str === "401" || str === "403" || str === "404") return "\x1b[33m" + str + "\x1b[0m";
  if (str.startsWith("4")) return "\x1b[34m" + str + "\x1b[0m";
  return "\x1b[31m" + str + "\x1b[0m";
}

async function main() {
  console.log("=== SAFE POSTS ===");
  const safePosts = [
    { label: "heartbeat",            path: "/api/heartbeat",                  method: "POST", session: NEWBIE, body: {} },
    { label: "settings/status",      path: "/api/settings/status",            method: "POST", session: NEWBIE, body: {} },
    { label: "recommend-existing",   path: "/api/resumes/recommend-existing", method: "POST", session: PREP,   body: { jdText: "Looking for a React + GraphQL engineer with TypeScript experience." } },
    { label: "recommend (no upload)", path: "/api/resumes/recommend-existing", method: "POST", session: NEWBIE, body: { jdText: "Looking for a React + GraphQL engineer with TypeScript experience." } },
  ];

  for (const t of safePosts) {
    const r = await hit(t);
    console.log(`${colorStatus(r.status)} ${r.label.padEnd(28)} ${String(r.ms).padStart(5)}ms ${r.body}`);
  }

  console.log("\n=== IDOR PROBES (expect 404/403, NEVER 200 or 500) ===");
  const r1 = await fetch(`${BASE}/api/resumes/generations`, { headers: { Cookie: `next-auth.session-token=${ALI}` } });
  const genList = await r1.json();
  const aliGenerationId = genList.generations?.[0]?.id;
  console.log(`  ali generation id: ${aliGenerationId ?? "(none — ali has no generations yet)"}`);

  if (aliGenerationId) {
    const probes = [
      { label: "newbie GET ali's gen",         path: `/api/resumes/generations/${aliGenerationId}`,            method: "GET",    session: NEWBIE },
      { label: "newbie GET ali's preview",     path: `/api/resumes/generations/${aliGenerationId}/preview`,    method: "GET",    session: NEWBIE },
      { label: "newbie GET ali's PDF",         path: `/api/resumes/generations/${aliGenerationId}/pdf`,        method: "GET",    session: NEWBIE },
      { label: "prepared GET ali's gen",       path: `/api/resumes/generations/${aliGenerationId}`,            method: "GET",    session: PREP   },
    ];
    for (const t of probes) {
      const r = await hit(t);
      const ok = r.status === 404 || r.status === 403;
      const marker = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
      console.log(`${marker} ${colorStatus(r.status)} ${t.label.padEnd(32)} ${String(r.ms).padStart(5)}ms ${r.body}`);
    }
  }

  console.log("\n=== UNAUTHENTICATED PROBES (expect 401 — NEVER 500) ===");
  const noAuth = [
    "/api/resumes/profile",
    "/api/resumes/generations",
    "/api/quota/me",
    "/api/applications/send-stats",
    "/api/heartbeat",
    "/api/onboarding/complete",
    "/api/resumes/coach-bullet",
    "/api/resumes/render-preview",
  ];
  for (const path of noAuth) {
    const method = path === "/api/heartbeat" || path === "/api/onboarding/complete" || path === "/api/resumes/coach-bullet" || path === "/api/resumes/render-preview" ? "POST" : "GET";
    const r = await hit({ label: `unauth ${method}`, path, method, body: method === "POST" ? {} : null });
    const ok = r.status === 401;
    const marker = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    console.log(`${marker} ${colorStatus(r.status)} ${path.padEnd(45)} ${r.body}`);
  }

  console.log("\n=== CRON PROBES (without CRON_SECRET, expect 401 — never trigger) ===");
  const cronRoutes = [
    "/api/cron/scrape-global",
    "/api/cron/match-all-users",
    "/api/cron/instant-apply",
    "/api/cron/send-queued",
    "/api/cron/follow-up",
  ];
  for (const path of cronRoutes) {
    const r = await hit({ label: "cron", path, method: "GET" });
    const ok = r.status === 401 || r.status === 403;
    const marker = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    console.log(`${marker} ${colorStatus(r.status)} ${path.padEnd(45)} ${r.body}`);
  }

  console.log("\n=== IDOR PROBES on write endpoints (PATCH/DELETE generation) ===");
  if (aliGenerationId) {
    const writeProbes = [
      { label: "newbie PATCH ali's gen",  path: `/api/resumes/generations/${aliGenerationId}`, method: "PATCH",  session: NEWBIE, body: { name: "hijacked" } },
      { label: "newbie DELETE ali's gen", path: `/api/resumes/generations/${aliGenerationId}`, method: "DELETE", session: NEWBIE },
    ];
    for (const t of writeProbes) {
      const r = await hit(t);
      const ok = r.status === 404 || r.status === 403;
      const marker = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
      console.log(`${marker} ${colorStatus(r.status)} ${t.label.padEnd(32)} ${String(r.ms).padStart(5)}ms ${r.body}`);
    }
  }
}

main();
