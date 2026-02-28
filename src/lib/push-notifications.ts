import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;

function ensureConfigured() {
  if (configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@jobpilot.app";

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  actions?: Array<{ action: string; title: string }>;
  requireInteraction?: boolean;
}

/**
 * Send a push notification to all subscribed devices for a user.
 * Removes stale subscriptions that return 404/410 (unsubscribed).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!ensureConfigured()) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;
  const staleIds: string[] = [];

  const jsonPayload = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        jsonPayload,
        { TTL: 3600 },
      );
      sent++;
    } catch (err: unknown) {
      const statusCode =
        err instanceof webpush.WebPushError ? err.statusCode : 0;
      if (statusCode === 404 || statusCode === 410) {
        staleIds.push(sub.id);
        removed++;
      } else {
        console.warn(`[Push] Failed for user ${userId}:`, err);
        failed++;
      }
    }
  }

  if (staleIds.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: staleIds } } })
      .catch((e) => console.error("[Push] Failed to clean stale subs:", e));
  }

  return { sent, failed, removed };
}

/**
 * Send push notifications for new job matches.
 */
export async function pushNewJobMatches(
  userId: string,
  jobCount: number,
  topJob?: { title: string; company: string },
): Promise<void> {
  const body = topJob
    ? `${topJob.title} at ${topJob.company}${jobCount > 1 ? ` + ${jobCount - 1} more` : ""}`
    : `${jobCount} new job${jobCount !== 1 ? "s" : ""} match your profile`;

  await sendPushToUser(userId, {
    title: `${jobCount} New Job${jobCount !== 1 ? "s" : ""} Found`,
    body,
    url: "/recommended",
    tag: "new-matches",
    actions: [
      { action: "view", title: "View Jobs" },
      { action: "dismiss", title: "Later" },
    ],
  });
}

/**
 * Send push notification for instant-apply results.
 */
export async function pushInstantApplyUpdate(
  userId: string,
  applied: number,
  drafted: number,
): Promise<void> {
  const parts: string[] = [];
  if (applied > 0) parts.push(`${applied} sent`);
  if (drafted > 0) parts.push(`${drafted} draft${drafted !== 1 ? "s" : ""} ready`);

  await sendPushToUser(userId, {
    title: "Applications Update",
    body: parts.join(", ") || "Your applications were processed",
    url: "/applications",
    tag: "instant-apply",
    actions: [{ action: "view", title: "View" }],
  });
}

/**
 * Send push notification for a time-sensitive LinkedIn post.
 */
export async function pushUrgentPost(
  userId: string,
  jobTitle: string,
  company: string,
  url: string,
): Promise<void> {
  await sendPushToUser(userId, {
    title: "New LinkedIn Post",
    body: `${company} is hiring: ${jobTitle}`,
    url,
    tag: `post-${company.toLowerCase().replace(/\s/g, "-")}`,
    requireInteraction: true,
    actions: [
      { action: "view", title: "Apply Now" },
      { action: "dismiss", title: "Skip" },
    ],
  });
}
