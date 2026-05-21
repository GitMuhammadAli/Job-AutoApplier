import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const tables = [
  "ResumeProfile",
  "ResumeVariant",
  "ResumeSummary",
  "ResumeExperience",
  "ResumeProject",
  "ResumeEducation",
  "ResumeCertification",
  "ResumeGeneration",
];

try {
  const results = [];
  for (const t of tables) {
    try {
      const r = await p.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`);
      results.push({ table: t, count: r[0].c, status: "exists" });
    } catch (e) {
      results.push({ table: t, count: null, status: `error: ${e.message.split("\n")[0]}` });
    }
  }
  console.log("\nTable counts against prod DB:");
  console.log("─".repeat(60));
  for (const r of results) {
    const c = r.count === null ? "—" : String(r.count);
    console.log(`  ${r.table.padEnd(24)} ${c.padStart(6)}   ${r.status === "exists" ? "" : r.status}`);
  }
  console.log("─".repeat(60));
  const dropTargets = results.filter((r) => ["ResumeProfile", "ResumeVariant"].includes(r.table));
  const anyNonEmpty = dropTargets.some((r) => r.count !== null && r.count > 0);
  console.log(`\nDestructive-drop targets non-empty: ${anyNonEmpty ? "YES — ABORT" : "NO — safe to drop"}`);
} finally {
  await p.$disconnect();
}
