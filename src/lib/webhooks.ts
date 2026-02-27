/**
 * Webhook alerts for scraper failures (Discord, Telegram).
 * Configure via ALERT_WEBHOOK_URL or ALERT_DISCORD_WEBHOOK / ALERT_TELEGRAM_BOT_TOKEN + ALERT_TELEGRAM_CHAT_ID.
 *
 * Each webhook gets one retry after 1s on failure before being dropped.
 */

export interface AlertPayload {
  title: string;
  message: string;
  severity?: "info" | "warning" | "error";
}

async function fetchWithRetry(url: string, options: RequestInit, label: string): Promise<void> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (firstErr) {
    console.warn(`[Webhook] ${label} failed, retrying in 1s:`, firstErr instanceof Error ? firstErr.message : firstErr);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (retryErr) {
      console.error(`[Webhook] ${label} failed after retry — alert lost:`, retryErr instanceof Error ? retryErr.message : retryErr);
    }
  }
}

export async function sendAlertWebhook(payload: AlertPayload): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  const discordUrl = process.env.ALERT_DISCORD_WEBHOOK;
  const telegramToken = process.env.ALERT_TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.ALERT_TELEGRAM_CHAT_ID;

  const promises: Promise<void>[] = [];
  const jsonHeaders = { "Content-Type": "application/json" };

  if (url) {
    promises.push(
      fetchWithRetry(url, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      }, "Generic"),
    );
  }

  if (discordUrl) {
    const content =
      payload.severity === "error"
        ? `🚨 **${payload.title}**\n${payload.message}`
        : `⚠️ **${payload.title}**\n${payload.message}`;
    promises.push(
      fetchWithRetry(discordUrl, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ content }),
      }, "Discord"),
    );
  }

  if (telegramToken && telegramChatId) {
    const text = `${payload.title}\n\n${payload.message}`;
    promises.push(
      fetchWithRetry(
        `https://api.telegram.org/bot${telegramToken}/sendMessage`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            chat_id: telegramChatId,
            text,
          }),
        },
        "Telegram",
      ),
    );
  }

  if (promises.length === 0) {
    console.debug("[Webhook] No webhook URLs configured — skipping alert:", payload.title);
    return;
  }

  await Promise.allSettled(promises);
}
