import { Suspense } from "react";
import { getApplications } from "@/app/actions/application";
import { ApplicationQueue } from "@/components/applications/ApplicationQueue";
import { SendingStatusBar } from "@/components/applications/SendingStatusBar";
import { getSendingStats } from "@/lib/send-limiter";
import { getAuthUserId } from "@/lib/auth";
import { ApplicationsSkeleton } from "@/components/shared/Skeletons";

export const dynamic = "force-dynamic";

export default function ApplicationsPage() {
  return (
    <div className="space-y-6">
      {/* Static header — renders instantly */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          Applications
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Manage your prepared applications before sending
        </p>
      </div>

      {/* Async data streams in */}
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
    isPaused: false,
    pausedUntil: null,
  };

  try {
    const userId = await getAuthUserId();
    [applications, sendingStats] = await Promise.all([
      getApplications(),
      getSendingStats(userId),
    ]);
  } catch (error) {
    console.error("[ApplicationsPage] Failed to load data:", error);
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/30 p-6 text-center">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">Failed to load applications</p>
        <p className="mt-1 text-xs text-red-600/70 dark:text-red-400/60">Please refresh the page to try again.</p>
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
      <ApplicationQueue applications={applications} counts={counts} />
    </>
  );
}
