import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getScraperHealthStatus } from "@/lib/scrapers/scraper-runner";
import { sendAlertWebhook } from "@/lib/webhooks";
import { HEALTH } from "@/lib/messages";

export const dynamic = "force-dynamic";

/** M8: Health check — requires CRON_SECRET or returns minimal status only */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace("Bearer ", "") || req.headers.get("x-cron-secret");
  const isAuthorized = secret && provided === secret;

  // Unauthenticated: return minimal ping response (no infrastructure details)
  if (!isAuthorized) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return NextResponse.json({ status: "ok" });
    } catch {
      return NextResponse.json({ status: "error" }, { status: 503 });
    }
  }
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      scraperHealth,
      globalJobCount,
      activeJobCount,
      todaySent,
      todayBounced,
      lock,
      errorLogs,
    ] = await Promise.all([
      getScraperHealthStatus(),
      prisma.globalJob.count(),
      prisma.globalJob.count({ where: { isActive: true } }),
      prisma.jobApplication.count({ where: { status: "SENT", sentAt: { gte: todayStart } } }),
      prisma.jobApplication.count({ where: { status: "BOUNCED", updatedAt: { gte: todayStart } } }),
      prisma.systemLock.findUnique({ where: { name: "scrape-global" } }),
      prisma.systemLog.count({ where: { type: "error", createdAt: { gte: since } } }),
    ]);

    // Determine overall status
    const scraperStatuses = Object.values(scraperHealth);
    const brokenCount = scraperStatuses.filter((s) => s.status === "broken").length;
    const degradedCount = scraperStatuses.filter((s) => s.status === "degraded").length;

    let overall: "healthy" | "degraded" | "broken";
    if (brokenCount >= 4) {
      overall = "broken";
    } else if (brokenCount > 0 || degradedCount > 2) {
      overall = "degraded";
    } else {
      overall = "healthy";
    }

    // Check SMTP connectivity
    let smtpConnected = false;
    try {
      if (process.env.SMTP_USER) {
        smtpConnected = true; // We don't verify here to keep health check fast
      }
    } catch { /* ignore */ }

    // Check Groq availability
    const groqAvailable = !!process.env.GROQ_API_KEY;

    const response = {
      overall,
      scrapers: Object.fromEntries(
        Object.entries(scraperHealth).map(([source, h]) => [
          source,
          {
            status: h.status,
            lastRun: h.lastRun ? relativeTime(h.lastRun) : "never",
            lastRunAt: h.lastRun?.toISOString() ?? null,
            lastJobCount: h.lastJobCount,
            consecutiveFailures: h.consecutiveFailures,
            lastError: h.lastError,
          },
        ])
      ),
      database: {
        connected: true,
        globalJobCount,
        activeJobCount,
      },
      email: {
        smtpConfigured: smtpConnected,
        todaySent,
        todayBounced,
      },
      ai: {
        groqAvailable,
      },
      scrapeLock: lock
        ? { isRunning: lock.isRunning, startedAt: lock.startedAt }
        : null,
      errorsLast24h: errorLogs,
    };

    // Send webhook alert if any scraper is broken
    if (brokenCount > 0) {
      const brokenSources = Object.entries(scraperHealth)
        .filter(([, h]) => h.status === "broken")
        .map(([s, h]) => `${s}: ${h.lastError || "unknown error"}`)
        .join("\n");
      await sendAlertWebhook({
        title: `JobPilot: ${brokenCount} scraper(s) broken`,
        message: brokenSources,
        severity: "error",
      }).catch((err) => console.error("[Health] Failed to send alert webhook:", err));
    }

    // Return non-200 if broken (for UptimeRobot)
    const httpStatus = overall === "broken" ? 503 : 200;
    return NextResponse.json(response, { status: httpStatus });
  } catch (error) {
    console.error("[health] Error:", error);
    return NextResponse.json(
      { overall: "error", error: HEALTH.HEALTH_CHECK_FAILED },
      { status: 500 },
    );
  }
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day(s) ago`;
}
