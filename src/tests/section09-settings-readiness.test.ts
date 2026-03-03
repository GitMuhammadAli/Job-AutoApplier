import { suite, test, eq, assert, summary } from "./test-harness";

// Replicate the readiness checklist logic from SettingsForm.tsx.
// The component renders a card when mode is SEMI_AUTO/FULL_AUTO/INSTANT,
// checking 5 conditions:
//   1. Mode is not MANUAL
//   2. autoApplyEnabled is true
//   3. At least 1 resume uploaded
//   4. At least 1 keyword
//   5. applicationEmail is set

interface ReadinessSettings {
  applicationMode: string;
  autoApplyEnabled: boolean;
  keywords: string[];
  applicationEmail: string;
}

function checkReadiness(settings: ReadinessSettings, resumeCount: number) {
  const isVisible = settings.applicationMode !== "MANUAL";
  const modeCheck = ["SEMI_AUTO", "FULL_AUTO", "INSTANT"].includes(settings.applicationMode);
  const autoApplyCheck = settings.autoApplyEnabled;
  const resumeCheck = resumeCount > 0;
  const keywordsCheck = settings.keywords.length > 0;
  const emailCheck = !!settings.applicationEmail;
  const allReady = modeCheck && autoApplyCheck && resumeCheck && keywordsCheck && emailCheck;

  return { isVisible, modeCheck, autoApplyCheck, resumeCheck, keywordsCheck, emailCheck, allReady };
}

async function main() {
  suite("SECTION 9 — Settings Readiness Checklist (8 tests)");

  await test("9.1 — All requirements met → allReady=true", () => {
    const r = checkReadiness({
      applicationMode: "SEMI_AUTO",
      autoApplyEnabled: true,
      keywords: ["react", "node"],
      applicationEmail: "test@gmail.com",
    }, 1);
    assert(r.allReady, "allReady should be true");
    assert(r.modeCheck, "modeCheck");
    assert(r.autoApplyCheck, "autoApplyCheck");
    assert(r.resumeCheck, "resumeCheck");
    assert(r.keywordsCheck, "keywordsCheck");
    assert(r.emailCheck, "emailCheck");
  });

  await test("9.2 — MANUAL mode → card not shown", () => {
    const r = checkReadiness({
      applicationMode: "MANUAL",
      autoApplyEnabled: true,
      keywords: ["react"],
      applicationEmail: "test@gmail.com",
    }, 1);
    eq(r.isVisible, false, "isVisible should be false");
  });

  await test("9.3 — No resume → Item 3 fails", () => {
    const r = checkReadiness({
      applicationMode: "SEMI_AUTO",
      autoApplyEnabled: true,
      keywords: ["react"],
      applicationEmail: "test@gmail.com",
    }, 0);
    eq(r.resumeCheck, false, "resumeCheck");
    eq(r.allReady, false, "allReady");
  });

  await test("9.4 — Empty keywords → Item 4 fails", () => {
    const r = checkReadiness({
      applicationMode: "SEMI_AUTO",
      autoApplyEnabled: true,
      keywords: [],
      applicationEmail: "test@gmail.com",
    }, 1);
    eq(r.keywordsCheck, false, "keywordsCheck");
    eq(r.allReady, false, "allReady");
  });

  await test("9.5 — No email configured → Item 5 fails", () => {
    const r = checkReadiness({
      applicationMode: "SEMI_AUTO",
      autoApplyEnabled: true,
      keywords: ["react"],
      applicationEmail: "",
    }, 1);
    eq(r.emailCheck, false, "emailCheck");
    eq(r.allReady, false, "allReady");
  });

  await test("9.6 — autoApplyEnabled false → Item 2 fails", () => {
    const r = checkReadiness({
      applicationMode: "SEMI_AUTO",
      autoApplyEnabled: false,
      keywords: ["react"],
      applicationEmail: "test@gmail.com",
    }, 1);
    eq(r.autoApplyCheck, false, "autoApplyCheck");
    eq(r.allReady, false, "allReady");
  });

  await test("9.7 — FULL_AUTO mode → Item 1 passes", () => {
    const r = checkReadiness({
      applicationMode: "FULL_AUTO",
      autoApplyEnabled: true,
      keywords: ["react"],
      applicationEmail: "test@gmail.com",
    }, 1);
    eq(r.modeCheck, true, "modeCheck");
  });

  await test("9.8 — INSTANT mode → Item 1 passes", () => {
    const r = checkReadiness({
      applicationMode: "INSTANT",
      autoApplyEnabled: true,
      keywords: ["react"],
      applicationEmail: "test@gmail.com",
    }, 1);
    eq(r.modeCheck, true, "modeCheck");
  });

  const s = summary();
  process.exit(s.failed > 0 ? 1 : 0);
}
main();
