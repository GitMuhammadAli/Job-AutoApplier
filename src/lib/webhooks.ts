/**
 * Webhook alerts for scraper failures (Discord, Telegram).
 * Configure via ALERT_WEBHOOK_URL or ALERT_DISCORD_WEBHOOK / ALERT_TELEGRAM_BOT_TOKEN + ALERT_TELEGRAM_CHAT_ID.
 */

export interface AlertPayload {
  title: string;
  message: string;
  severity?: "info" | "warning" | "error";
}

export async function sendAlertWebhook(payload: AlertPayload): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  const discordUrl = process.env.ALERT_DISCORD_WEBHOOK;
  const telegramToken = process.env.ALERT_TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.ALERT_TELEGRAM_CHAT_ID;

  const promises: Promise<unknown>[] = [];

  if (url) {
    promises.push(
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((e) => console.warn("[Webhook] Generic failed:", e)),
    );
  }

  if (discordUrl) {
    const content =
      payload.severity === "error"
        ? `🚨 **${payload.title}**\n${payload.message}`
        : `⚠️ **${payload.title}**\n${payload.message}`;
    promises.push(
      fetch(discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }).catch((e) => console.warn("[Webhook] Discord failed:", e)),
    );
  }

  if (telegramToken && telegramChatId) {
    const text = `${payload.title}\n\n${payload.message}`;
    promises.push(
      fetch(
        `https://api.telegram.org/bot${telegramToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text,
          }),
        },
      ).catch((e) => console.warn("[Webhook] Telegram failed:", e)),
    );
  }

  if (promises.length === 0) {
    console.debug("[Webhook] No webhook URLs configured — skipping alert:", payload.title);
    return;
  }

  await Promise.allSettled(promises);
}
