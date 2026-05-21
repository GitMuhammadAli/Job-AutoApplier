import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

try {
  // 1. Did Prisma create the _prisma_migrations table?
  const migrationsTable = await p.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
    ) AS exists
  `);
  console.log(`_prisma_migrations table exists: ${migrationsTable[0].exists}`);

  if (migrationsTable[0].exists) {
    const rows = await p.$queryRawUnsafe(`SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 10`);
    console.log("\nMigration history rows:");
    for (const r of rows) {
      console.log(`  ${r.migration_name}  finished_at=${r.finished_at}`);
    }
  }

  // 2. Confirm the destructive-drop targets are still present and empty
  const tables = ["ResumeProfile", "ResumeVariant"];
  console.log("\nDestructive-drop targets:");
  for (const t of tables) {
    const exists = await p.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '${t}'
      ) AS exists
    `);
    if (exists[0].exists) {
      const cnt = await p.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`);
      console.log(`  ${t}: EXISTS, ${cnt[0].c} rows`);
    } else {
      console.log(`  ${t}: DOES NOT EXIST`);
    }
  }

  // 3. Confirm UserSettings does NOT yet have the new columns (proof migration didn't run)
  const cols = await p.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'UserSettings'
      AND column_name IN ('resumeHeadline', 'resumeSkills', 'resumeSkillsLocked')
    ORDER BY column_name
  `);
  console.log(`\nUserSettings new columns present (should be 0 if migration didn't run): ${cols.length}`);
  for (const c of cols) console.log(`  ${c.column_name}`);
} finally {
  await p.$disconnect();
}
