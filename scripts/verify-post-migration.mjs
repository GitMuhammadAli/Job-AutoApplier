import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

try {
  // Check 1: UserSettings has the new columns
  const cols = await p.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'UserSettings'
      AND column_name IN ('resumeHeadline', 'resumeSkills', 'resumeSkillsLocked')
    ORDER BY column_name
  `);
  console.log(`Check 1 — UserSettings new columns (expect 3):`);
  for (const c of cols) {
    console.log(`  ${c.column_name.padEnd(22)} ${c.data_type.padEnd(15)} nullable=${c.is_nullable} default=${c.column_default ?? "—"}`);
  }
  console.log(`  Result: ${cols.length === 3 ? "✅ PASS" : "❌ FAIL"}\n`);

  // Check 2: ResumeProfile table dropped
  const rp = await p.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'ResumeProfile'
    ) AS exists
  `);
  console.log(`Check 2 — ResumeProfile dropped:`);
  console.log(`  Result: ${!rp[0].exists ? "✅ PASS (table gone)" : "❌ FAIL (table still exists)"}\n`);

  // Check 3: ResumeVariant table dropped
  const rv = await p.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'ResumeVariant'
    ) AS exists
  `);
  console.log(`Check 3 — ResumeVariant dropped:`);
  console.log(`  Result: ${!rv[0].exists ? "✅ PASS (table gone)" : "❌ FAIL (table still exists)"}\n`);

  // Check 4: _prisma_migrations row for the flatten migration
  const mig = await p.$queryRawUnsafe(`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    WHERE migration_name LIKE '%resume_flatten%'
  `);
  console.log(`Check 4 — _prisma_migrations row for flatten:`);
  if (mig.length === 0) {
    console.log(`  ❌ FAIL — no row found`);
  } else {
    for (const m of mig) {
      console.log(`  ${m.migration_name}  finished_at=${m.finished_at}  rolled_back_at=${m.rolled_back_at ?? "—"}`);
    }
    console.log(`  Result: ✅ PASS`);
  }

  // Bonus: list all child tables with their new userId column
  console.log(`\nBonus — child tables now keyed by userId:`);
  const childTables = ["ResumeSummary", "ResumeExperience", "ResumeProject", "ResumeEducation", "ResumeCertification", "ResumeGeneration"];
  for (const t of childTables) {
    const hasUserId = await p.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${t}' AND column_name = 'userId'
      ) AS exists
    `);
    const hasProfileId = await p.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${t}' AND column_name = 'profileId'
      ) AS exists
    `);
    const ok = hasUserId[0].exists && !hasProfileId[0].exists;
    console.log(`  ${t.padEnd(22)} userId=${hasUserId[0].exists} profileId=${hasProfileId[0].exists}  ${ok ? "✅" : "❌"}`);
  }
} finally {
  await p.$disconnect();
}
