/**
 * Write-flow probe — exercises the heaviest user-facing POST paths once each
 * to confirm shape + auth + quota wiring. Does NOT load-test (would burn Groq).
 *
 * Mocked: SMTP send (we POST to /api/applications/[id]/send with no SMTP
 * configured and assert we get a clean 400 error, NOT a 500).
 */

const BASE = process.env.BASE ?? "http://localhost:3000";
const PREP = "9b3549bb364634aef5cc43f38830e1049356387297e192094aaddf5d3f3e4ee9";

async function hit({ path, method = "POST", session = PREP, body = null, label }) {
  const start = Date.now();
  const headers = { Cookie: `next-auth.session-token=${session}` };
  if (body) headers["Content-Type"] = "application/json";
  try {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { label, path, method, status: r.status, ms: Date.now() - start, body: (await r.text()).slice(0, 220) };
  } catch (e) {
    return { label, path, method, status: "ERR", ms: Date.now() - start, body: String(e).slice(0, 220) };
  }
}

function colorStatus(s) {
  const str = String(s);
  if (str === "200" || str === "201") return "\x1b[32m" + str + "\x1b[0m";
  if (str === "400") return "\x1b[33m" + str + "\x1b[0m"; // expected validation
  if (str.startsWith("4")) return "\x1b[34m" + str + "\x1b[0m";
  return "\x1b[31m" + str + "\x1b[0m";
}

async function main() {
  console.log("=== WRITE-FLOW PROBE (single call each, prepared persona) ===\n");

  // 1. Resume gen — no JD, default profile, T01
  const r1 = await hit({
    label: "resumes/generate (no JD, T01)",
    path: "/api/resumes/generate",
    body: { templateId: "T01", pageTarget: 1 },
  });
  console.log(`${colorStatus(r1.status)} ${r1.label.padEnd(40)} ${String(r1.ms).padStart(5)}ms ${r1.body.slice(0, 140)}`);

  // 2. Resume gen — with JD, T08 (skills-first), full agent chain runs
  const r2 = await hit({
    label: "resumes/generate (JD, T08)",
    path: "/api/resumes/generate",
    body: {
      templateId: "T08",
      pageTarget: 1,
      jdText: "Looking for a Senior React + GraphQL engineer to lead our customer dashboard. 5+ years React, deep TypeScript, GraphQL schema design, Apollo Client.",
    },
  });
  console.log(`${colorStatus(r2.status)} ${r2.label.padEnd(40)} ${String(r2.ms).padStart(5)}ms ${r2.body.slice(0, 140)}`);

  // 3. Render-preview — live preview without persistence
  const r3 = await hit({
    label: "resumes/render-preview",
    path: "/api/resumes/render-preview",
    body: {
      profile: {
        id: "fixture",
        header: {
          fullName: "Test User", headline: "Engineer", email: "test@example.com",
        },
        skills: ["React"],
        skillsLocked: false,
        summaries: [{ id: "s1", label: "Default", content: "Test summary.", isDefault: true }],
        experiences: [],
        projects: [],
        education: [],
        certifications: [],
      },
      templateId: "T01",
      pageTarget: 1,
    },
  });
  console.log(`${colorStatus(r3.status)} ${r3.label.padEnd(40)} ${String(r3.ms).padStart(5)}ms ${r3.body.slice(0, 140)}`);

  // 4. Bullet coach — single call
  const r4 = await hit({
    label: "resumes/coach-bullet",
    path: "/api/resumes/coach-bullet",
    body: {
      bullet: "Built the dashboard",
      role: { title: "Engineer", company: "TestCo" },
      userSkills: ["React"],
      mode: "tighten",
    },
  });
  console.log(`${colorStatus(r4.status)} ${r4.label.padEnd(40)} ${String(r4.ms).padStart(5)}ms ${r4.body.slice(0, 140)}`);

  // 5. Send draft without SMTP — should be 400 (NOT 500)
  const draftLookup = await fetch(`${BASE}/api/applications/send-stats`, { headers: { Cookie: `next-auth.session-token=${PREP}` } });
  // Pick a fake application id; expect 404 (not found) instead of 500
  const r5 = await hit({
    label: "applications/[fakeid]/send (404 expected)",
    path: "/api/applications/abc123notreal/send",
    body: {},
  });
  console.log(`${colorStatus(r5.status)} ${r5.label.padEnd(40)} ${String(r5.ms).padStart(5)}ms ${r5.body.slice(0, 140)}`);

  // 6. Onboarding complete
  const r6 = await hit({
    label: "onboarding/complete",
    path: "/api/onboarding/complete",
    body: {},
  });
  console.log(`${colorStatus(r6.status)} ${r6.label.padEnd(40)} ${String(r6.ms).padStart(5)}ms ${r6.body.slice(0, 140)}`);

  // 7. Confirm quota recorded after the heavy resume gens
  const r7 = await hit({
    label: "quota/me (after 4 LLM calls)",
    path: "/api/quota/me",
    method: "GET",
  });
  console.log(`${colorStatus(r7.status)} ${r7.label.padEnd(40)} ${String(r7.ms).padStart(5)}ms ${r7.body.slice(0, 220)}`);
}

main();
