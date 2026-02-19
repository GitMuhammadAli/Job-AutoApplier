import { prisma } from "@/lib/prisma";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface LimitResult {
  allowed: boolean;
  reason?: string;
  waitSeconds?: number;
  stats?: {
    todayCount: number;
    hourCount: number;
    maxPerDay: number;
    maxPerHour: number;
  };
}

export async function canSendNow(userId: string): Promise<LimitResult> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });
  if (!settings) {
    return { allowed: false, reason: "Settings not configured." };
  }

  const now = new Date();

  // Check 1: Sending paused
  if (settings.sendingPausedUntil && settings.sendingPausedUntil > now) {
    const waitMs = settings.sendingPausedUntil.getTime() - now.getTime();
    return {
      allowed: false,
      reason: `Sending paused. Resumes in ${Math.ceil(waitMs / 60000)} minutes.`,
      waitSeconds: Math.ceil(waitMs / 1000),
    };
  }

  // Check 2: Account status
  if (settings.accountStatus !== "active") {
    return { allowed: false, reason: "Account is paused or disabled." };
  }

  const todayStart = startOfDay(now);

  // Check 3: Daily limit
  const todayCount = await prisma.jobApplication.count({
    where: { userId, status: "SENT", sentAt: { gte: todayStart } },
  });
  if (todayCount >= settings.maxSendsPerDay) {
    return {
      allowed: false,
      reason: `Daily limit reached (${todayCount}/${settings.maxSendsPerDay}). Resets at midnight.`,
      stats: {
        todayCount,
        hourCount: 0,
        maxPerDay: settings.maxSendsPerDay,
        maxPerHour: settings.maxSendsPerHour,
      },
    };
  }

  // Check 4: Hourly limit
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const hourCount = await prisma.jobApplication.count({
    where: { userId, status: "SENT", sentAt: { gte: hourAgo } },
  });
  if (hourCount >= settings.maxSendsPerHour) {
    return {
      allowed: false,
      reason: `Hourly limit reached (${hourCount}/${settings.maxSendsPerHour}). Wait a bit.`,
      stats: {
        todayCount,
        hourCount,
        maxPerDay: settings.maxSendsPerDay,
        maxPerHour: settings.maxSendsPerHour,
      },
    };
  }

  // Check 5: Minimum delay between sends
  const lastSent = await prisma.jobApplication.findFirst({
    where: { userId, status: "SENT" },
    orderBy: { sentAt: "desc" },
  });
  if (lastSent?.sentAt) {
    const elapsedSeconds =
      (now.getTime() - lastSent.sentAt.getTime()) / 1000;
    if (elapsedSeconds < settings.sendDelaySeconds) {
      const wait = Math.ceil(settings.sendDelaySeconds - elapsedSeconds);
      return {
        allowed: false,
        reason: `Wait ${wait}s before next send.`,
        waitSeconds: wait,
        stats: {
          todayCount,
          hourCount,
          maxPerDay: settings.maxSendsPerDay,
          maxPerHour: settings.maxSendsPerHour,
        },
      };
    }
  }

  // Check 6: Bounce auto-pause (3 bounces today)
  const todayBounces = await prisma.jobApplication.count({
    where: { userId, status: "BOUNCED", updatedAt: { gte: todayStart } },
  });
  if (todayBounces >= 3) {
    const pauseUntil = new Date(
      now.getTime() + settings.bouncePauseHours * 60 * 60 * 1000
    );
    await prisma.userSettings.update({
      where: { userId },
      data: { sendingPausedUntil: pauseUntil },
    });
    return {
      allowed: false,
      reason: `3 bounces today. Sending paused for ${settings.bouncePauseHours}h to protect your email reputation.`,
    };
  }

  return {
    allowed: true,
    stats: {
      todayCount,
      hourCount,
      maxPerDay: settings.maxSendsPerDay,
      maxPerHour: settings.maxSendsPerHour,
    },
  };
}

/** Used by the SendingStatusBar on /applications (server-side) */
export async function getSendingStats(userId: string) {
  const todayStart = startOfDay(new Date());
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      maxSendsPerDay: true,
      maxSendsPerHour: true,
      sendDelaySeconds: true,
      sendingPausedUntil: true,
    },
  });

  const [todayCount, hourCount] = await Promise.all([
    prisma.jobApplication.count({
      where: { userId, status: "SENT", sentAt: { gte: todayStart } },
    }),
    prisma.jobApplication.count({
      where: { userId, status: "SENT", sentAt: { gte: hourAgo } },
    }),
  ]);

  return {
    todaySent: todayCount,
    todayMax: settings?.maxSendsPerDay ?? 20,
    hourSent: hourCount,
    hourMax: settings?.maxSendsPerHour ?? 8,
    isPaused:
      settings?.sendingPausedUntil != null &&
      settings.sendingPausedUntil > new Date(),
    pausedUntil: settings?.sendingPausedUntil ?? null,
  };
}

/** Used by the client-side /api/applications/send-stats endpoint */
export async function getSendStats(userId: string) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });
  if (!settings) return null;

  const now = new Date();
  const todayStart = startOfDay(now);
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const [todayCount, hourCount] = await Promise.all([
    prisma.jobApplication.count({
      where: { userId, status: "SENT", sentAt: { gte: todayStart } },
    }),
    prisma.jobApplication.count({
      where: { userId, status: "SENT", sentAt: { gte: hourAgo } },
    }),
  ]);

  const lastSent = await prisma.jobApplication.findFirst({
    where: { userId, status: "SENT" },
    orderBy: { sentAt: "desc" },
  });
  const nextSendIn = lastSent?.sentAt
    ? Math.max(
        0,
        settings.sendDelaySeconds -
          Math.floor((now.getTime() - lastSent.sentAt.getTime()) / 1000)
      )
    : 0;

  return {
    todayCount,
    hourCount,
    maxPerDay: settings.maxSendsPerDay,
    maxPerHour: settings.maxSendsPerHour,
    nextSendInSeconds: nextSendIn,
    isPaused: settings.sendingPausedUntil
      ? settings.sendingPausedUntil > now
      : false,
    pausedUntil: settings.sendingPausedUntil,
  };
}
