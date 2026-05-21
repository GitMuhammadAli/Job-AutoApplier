import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const p = new PrismaClient();
const sql = await readFile(
  new URL("../prisma/migrations/20260522_resume_flatten/migration.sql", import.meta.url),
  "utf8",
);

// Extract just the guard DO $$ block (between line 23 and the END $$;)
const guardMatch = sql.match(/DO \$\$[\s\S]*?END \$\$;/);
if (!guardMatch) {
  console.error("Could not find guard block in migration.sql");
  process.exit(1);
}
const guard = guardMatch[0];

try {
  // Run inside a single transaction so nothing persists.
  await p.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(guard);
    console.log("✅ Guard block executed without raising — destructive drop is safe to proceed.");
    throw new Error("__ROLLBACK_SENTINEL__");
  });
} catch (e) {
  if (e.message === "__ROLLBACK_SENTINEL__") {
    console.log("✅ Transaction rolled back as planned. No persistent side effects.");
    await p.$disconnect();
    process.exit(0);
  }
  console.error("❌ Guard block raised:", e.message);
  await p.$disconnect();
  process.exit(1);
}
