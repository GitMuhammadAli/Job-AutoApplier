import {
  getApplications,
  getApplicationCounts,
} from "@/app/actions/application";
import { ApplicationQueue } from "@/components/applications/ApplicationQueue";
import { SendingStatusBar } from "@/components/applications/SendingStatusBar";
import { getSendingStats } from "@/lib/send-limiter";
import { getAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  let applications: Awaited<ReturnType<typeof getApplications>> = [];
  let counts: Awaited<ReturnType<typeof getApplicationCounts>> = {
    draft: 0,
    ready: 0,
    sent: 0,
    failed: 0,
    bounced: 0,
    total: 0,
  };
  let sendingStats: Awaited<ReturnType<typeof getSendingStats>> = {
    todaySent: 0,
    todayMax: 20,
    hourSent: 0,
    hourMax: 8,
    isPaused: false,
    pausedUntil: null,
  };
  let loadError = false;

  try {
    const userId = await getAuthUserId();
    [applications, counts, sendingStats] = await Promise.all([
      getApplications(),
      getApplicationCounts(),
      getSendingStats(userId),
    ]);
  } catch (error) {
    console.error("[ApplicationsPage] Failed to load data:", error);
    loadError = true;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          Application Queue
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Manage your prepared applications before sending
        </p>
      </div>
      {loadError ? (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/30 p-6 text-center">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">Failed to load applications</p>
          <p className="mt-1 text-xs text-red-600/70 dark:text-red-400/60">Please refresh the page to try again.</p>
        </div>
      ) : (
        <>
          <SendingStatusBar
            sentToday={sendingStats.todaySent}
            maxPerDay={sendingStats.todayMax}
            sentThisHour={sendingStats.hourSent}
            maxPerHour={sendingStats.hourMax}
            isPaused={sendingStats.isPaused}
          />
          <ApplicationQueue applications={applications} counts={counts} />
        </>
      )}
    </div>
  );
}
