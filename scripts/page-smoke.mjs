/**
 * Page render smoke pass. For each persona, GET every page URL and assert
 * 200 (or expected redirect). Catches: render crashes, hydration failures,
 * broken auth gating, missing-data 500s.
 *
 * Does NOT exercise client-side state — just confirms the SSR + first paint
 * pipeline holds. Pair with MCP for interaction smoke on a few high-value flows.
 */

const BASE = process.env.BASE ?? "http://localhost:3000";

const PERSONAS = {
  newbie:   "47868737ebde03f09037a769696efddf6e2e4ed6200fac489174ba35c85475ff",
  ali:      "bc75afeb293c25b1d6f07e82f5b4a143f3b705ac81589684fa14f1e53bd58bc7",
  prepared: "9b3549bb364634aef5cc43f38830e1049356387297e192094aaddf5d3f3e4ee9",
};

// User-facing pages. Admin pages tested separately with a different gate.
const PAGES = [
  "/dashboard",
  "/recommended",
  "/applications",
  "/resumes",
  "/resumes/setup",
  "/templates",
  "/analytics",
  "/system-health",
  "/diagnostics/scrapers",
  "/settings",
  "/jobs",
  "/jobs/new",
];

// Public / landing — no session required
const PUBLIC_PAGES = [
  "/",
  "/features",
  "/faq",
  "/how-it-works",
  "/modes",
  "/login",
];

async function hit(path, session = null) {
  const start = Date.now();
  const headers = {};
  if (session) headers.Cookie = `next-auth.session-token=${session}`;
  try {
    const r = await fetch(`${BASE}${path}`, { headers, redirect: "manual" });
    return { path, status: r.status, ms: Date.now() - start, location: r.headers.get("location") };
  } catch (e) {
    return { path, status: "ERR", ms: Date.now() - start, location: String(e).slice(0, 80) };
  }
}

function colorStatus(s) {
  const str = String(s);
  if (str === "200") return "\x1b[32m200\x1b[0m";
  if (str.startsWith("3")) return "\x1b[36m" + str + "\x1b[0m";
  if (str === "401" || str === "403" || str === "404") return "\x1b[33m" + str + "\x1b[0m";
  if (str.startsWith("4")) return "\x1b[34m" + str + "\x1b[0m";
  return "\x1b[31m" + str + "\x1b[0m";
}

async function main() {
  const fails = [];

  console.log("=== PUBLIC PAGES (no auth) ===");
  for (const path of PUBLIC_PAGES) {
    const r = await hit(path);
    const ok = r.status === 200 || (r.status >= 300 && r.status < 400);
    if (!ok) fails.push({ ...r, persona: "(anon)" });
    console.log(`${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${colorStatus(r.status)} ${path.padEnd(28)} ${String(r.ms).padStart(5)}ms ${r.location ?? ""}`);
  }

  console.log("\n=== USER PAGES PER PERSONA ===");
  for (const [name, session] of Object.entries(PERSONAS)) {
    console.log(`\n--- ${name} ---`);
    for (const path of PAGES) {
      const r = await hit(path, session);
      const ok = r.status === 200 || (r.status >= 300 && r.status < 400);
      if (!ok) fails.push({ ...r, persona: name });
      console.log(`${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${colorStatus(r.status)} ${path.padEnd(28)} ${String(r.ms).padStart(5)}ms ${r.location ?? ""}`);
    }
  }

  console.log(`\n${PUBLIC_PAGES.length + PAGES.length * 3} hits · ${fails.length} failures`);
  if (fails.length) {
    console.log("\n--- failures ---");
    for (const f of fails) console.log(`${f.persona} ${f.path}: ${f.status} (${f.location ?? ""})`);
    process.exit(1);
  }
}

main();
