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
    warmupDay?: number;
    warmupTotal?: number;
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

  // Check 2b: Email warmup — progressive limits for new SMTP accounts
  const warmupLimits = getWarmupLimits(settings.smtpSetupDate);
  const effectiveMaxPerDay = Math.min(settings.maxSendsPerDay, warmupLimits.maxPerDay);
  const effectiveMaxPerHour = Math.min(settings.maxSendsPerHour, warmupLimits.maxPerHour);

  const todayStart = startOfDay(now);

  // Check 3: Daily limit (respects warmup limits)
  const todayCount = await prisma.jobApplication.count({
    where: { userId, status: "SENT", sentAt: { gte: todayStart } },
  });
  if (todayCount >= effectiveMaxPerDay) {
    return {
      allowed: false,
      reason: warmupLimits.isWarmup
        ? `Email warmup: Day ${warmupLimits.day}/7 — limit ${effectiveMaxPerDay}/day (${todayCount} sent). Full capacity after warmup.`
        : `Daily limit reached (${todayCount}/${effectiveMaxPerDay}). Resets at midnight.`,
      stats: {
        todayCount,
        hourCount: 0,
        maxPerDay: effectiveMaxPerDay,
        maxPerHour: effectiveMaxPerHour,
      },
    };
  }

  // Check 4: Hourly limit
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const hourCount = await prisma.jobApplication.count({
    where: { userId, status: "SENT", sentAt: { gte: hourAgo } },
  });
  if (hourCount >= effectiveMaxPerHour) {
    return {
      allowed: false,
      reason: warmupLimits.isWarmup
        ? `Email warmup: Day ${warmupLimits.day}/7 — limit ${effectiveMaxPerHour}/hour. Full capacity after warmup.`
        : `Hourly limit reached (${hourCount}/${effectiveMaxPerHour}). Wait a bit.`,
      stats: {
        todayCount,
        hourCount,
        maxPerDay: effectiveMaxPerDay,
        maxPerHour: effectiveMaxPerHour,
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
          maxPerDay: effectiveMaxPerDay,
          maxPerHour: effectiveMaxPerHour,
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
      maxPerDay: effectiveMaxPerDay,
      maxPerHour: effectiveMaxPerHour,
      ...(warmupLimits.isWarmup ? { warmupDay: warmupLimits.day, warmupTotal: 7 } : {}),
    },
  };
}

/**
 * Progressive send limits for new SMTP accounts to avoid spam flags.
 * Day 1-3: max 3/day, 2/hour
 * Day 4-7: max 8/day, 4/hour
 * Day 8+:  user's configured limits (no warmup)
 */
function getWarmupLimits(smtpSetupDate: Date | null | undefined): {
  isWarmup: boolean;
  day: number;
  maxPerDay: number;
  maxPerHour: number;
} {
  if (!smtpSetupDate) {
    return { isWarmup: false, day: 0, maxPerDay: Infinity, maxPerHour: Infinity };
  }

  const daysSinceSetup = Math.floor(
    (Date.now() - new Date(smtpSetupDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const day = daysSinceSetup + 1;

  if (day <= 3) {
    return { isWarmup: true, day, maxPerDay: 3, maxPerHour: 2 };
  }
  if (day <= 7) {
    return { isWarmup: true, day, maxPerDay: 8, maxPerHour: 4 };
  }
  return { isWarmup: false, day, maxPerDay: Infinity, maxPerHour: Infinity };
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
