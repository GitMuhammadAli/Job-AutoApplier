import { prisma } from "@/lib/prisma";

export async function acquireLock(name: string, timeoutMs = 10 * 60 * 1000): Promise<boolean> {
  const lock = await prisma.systemLock.findUnique({ where: { name } });

  if (lock?.isRunning && lock.startedAt) {
    const elapsed = Date.now() - lock.startedAt.getTime();
    if (elapsed < timeoutMs) return false;
    // Stale lock — process probably crashed, steal it
  }

  await prisma.systemLock.upsert({
    where: { name },
    update: { isRunning: true, startedAt: new Date() },
    create: { name, isRunning: true, startedAt: new Date() },
  });

  return true;
}

export async function releaseLock(name: string): Promise<void> {
  await prisma.systemLock.update({
    where: { name },
    data: { isRunning: false, completedAt: new Date() },
  }).catch(() => {});
}

export async function isLockHeld(name: string): Promise<boolean> {
  const lock = await prisma.systemLock.findUnique({ where: { name } });
  if (!lock?.isRunning) return false;
  if (!lock.startedAt) return false;
  const elapsed = Date.now() - lock.startedAt.getTime();
  return elapsed < 10 * 60 * 1000;
}
