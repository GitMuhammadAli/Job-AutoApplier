import { prisma } from "@/lib/prisma";

interface NotificationCheck {
  allowed: boolean;
  reason?: string;
}

export async function checkNotificationLimit(
  userId: string
): Promise<boolean> {
  const result = await canSendNotification(userId);
  return result.allowed;
}

export async function canSendNotification(
  userId: string
): Promise<NotificationCheck> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });
  if (!settings)
    return { allowed: false, reason: "No settings" };

  if (!settings.emailNotifications) {
    return { allowed: false, reason: "Notifications disabled" };
  }

  const frequency = settings.notificationFrequency || "daily";
  if (frequency === "off") {
    return { allowed: false, reason: "Frequency set to off" };
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const [dayCount, hourCount] = await Promise.all([
    prisma.systemLog.count({
      where: {
        type: "notification",
        source: userId,
        createdAt: { gte: startOfDay },
      },
    }),
    prisma.systemLog.count({
      where: {
        type: "notification",
        source: userId,
        createdAt: { gte: oneHourAgo },
      },
    }),
  ]);

  if (dayCount >= 3) {
    return {
      allowed: false,
      reason: "Daily notification limit (3) reached",
    };
  }

  if (hourCount >= 1) {
    return {
      allowed: false,
      reason: "Hourly notification limit (1) reached",
    };
  }

  if (frequency === "daily" && dayCount >= 1) {
    return {
      allowed: false,
      reason: "Daily frequency: already sent today",
    };
  }

  return { allowed: true };
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

export async function logNotificationSent(
  userId: string,
  subject: string
): Promise<void> {
  await recordNotification(userId, `Notification: ${subject}`);
}
