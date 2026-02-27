import { prisma } from "@/lib/prisma";

/**
 * Atomic lock acquisition using raw SQL INSERT ON CONFLICT.
 * Prevents TOCTOU race where two callers both read isRunning=false and both acquire.
 */
export async function acquireLock(name: string, timeoutMs = 10 * 60 * 1000): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - timeoutMs);

  const result = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `INSERT INTO "SystemLock" ("name", "isRunning", "startedAt")
     VALUES ($1, true, NOW())
     ON CONFLICT ("name") DO UPDATE
       SET "isRunning" = true, "startedAt" = NOW()
       WHERE "SystemLock"."isRunning" = false
          OR "SystemLock"."startedAt" IS NULL
          OR "SystemLock"."startedAt" < $2
     RETURNING "name"`,
    name,
    staleThreshold,
  );

  return result.length > 0;
}

export async function releaseLock(name: string): Promise<void> {
  await prisma.systemLock.update({
    where: { name },
    data: { isRunning: false, completedAt: new Date() },
  }).catch((err) => console.error(`[SystemLock] Failed to release lock '${name}':`, err));
}

export async function isLockHeld(name: string): Promise<boolean> {
  const lock = await prisma.systemLock.findUnique({ where: { name } });
  if (!lock?.isRunning) return false;
  if (!lock.startedAt) return false;
  const elapsed = Date.now() - lock.startedAt.getTime();
  return elapsed < 10 * 60 * 1000;
}
