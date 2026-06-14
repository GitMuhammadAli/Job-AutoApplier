import { Suspense } from "react";
import { getApplications, getDraftableJobCount } from "@/app/actions/application";
import { ApplicationQueue } from "@/components/applications/ApplicationQueue";
import { SendingStatusBar } from "@/components/applications/SendingStatusBar";
import { getSendingStats } from "@/lib/send-limiter";
import { getAuthUserId } from "@/lib/auth";
import { ApplicationsSkeleton } from "@/components/shared/Skeletons";

export default function ApplicationsPage() {
  return (
    <div className="space-y-6 animate-page-enter">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500 mb-1">
          Outreach
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          Applications
        </h1>
        <p className="mt-1.5 text-[13px] sm:text-sm leading-relaxed text-stone-500 dark:text-stone-400 max-w-prose">
          Draft → Ready → Sent. Drafts are auto-written; review before they queue.
        </p>
      </header>

      <Suspense fallback={<ApplicationsSkeleton />}>
        <ApplicationsContent />
      </Suspense>
    </div>
  );
}

async function ApplicationsContent() {
  let applications: Awaited<ReturnType<typeof getApplications>> = [];
  let sendingStats: Awaited<ReturnType<typeof getSendingStats>> = {
    todaySent: 0,
    todayMax: 20,
    hourSent: 0,
    hourMax: 8,
    sendDelaySeconds: 120,
    cooldownMinutes: 30,
    bouncePauseHours: 24,
    nextSendInSeconds: 0,
    isPaused: false,
    pausedUntil: null,
    provider: "Brevo",
  };
  let draftableCount = 0;

  try {
    const userId = await getAuthUserId();
    [applications, sendingStats, draftableCount] = await Promise.all([
      getApplications(),
      getSendingStats(userId),
      getDraftableJobCount(),
    ]);
  } catch (error) {
    console.error("[ApplicationsPage] Failed to load data:", error);
    return (
      <div className="rounded-2xl border border-rose-200/60 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30 p-6 text-center shadow-soft-sm">
        <p className="text-[13px] font-medium text-rose-700 dark:text-rose-300">
          We couldn't load your applications.
        </p>
        <p className="mt-1 text-[12px] text-rose-600/70 dark:text-rose-400/60">
          Refresh the page to try again.
        </p>
      </div>
    );
  }

  const counts = {
    draft: applications.filter((a) => a.status === "DRAFT").length,
    ready: applications.filter((a) => a.status === "READY").length,
    sent: applications.filter((a) => a.status === "SENT").length,
    failed: applications.filter((a) => a.status === "FAILED").length,
    bounced: applications.filter((a) => a.status === "BOUNCED").length,
    total: applications.length,
  };

  return (
    <>
      <SendingStatusBar
        sentToday={sendingStats.todaySent}
        maxPerDay={sendingStats.todayMax}
        sentThisHour={sendingStats.hourSent}
        maxPerHour={sendingStats.hourMax}
        isPaused={sendingStats.isPaused}
      />
      <ApplicationQueue applications={applications} counts={counts} draftableCount={draftableCount} />
    </>
  );
}
