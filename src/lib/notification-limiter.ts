import { prisma } from "@/lib/prisma";

export async function checkNotificationLimit(
  userId: string
): Promise<boolean> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [hourCount, dayCount] = await Promise.all([
    prisma.systemLog.count({
      where: {
        type: "notification",
        source: userId,
        createdAt: { gte: hourAgo },
      },
    }),
    prisma.systemLog.count({
      where: {
        type: "notification",
        source: userId,
        createdAt: { gte: todayStart },
      },
    }),
  ]);

  if (hourCount >= 1) return false;
  if (dayCount >= 3) return false;

  return true;
}

export async function recordNotification(
  userId: string,
  message: string
): Promise<void> {
  await prisma.systemLog.create({
    data: {
      type: "notification",
      source: userId,
      message,
    },
  });
}
