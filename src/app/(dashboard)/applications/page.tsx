import { getApplications, getApplicationCounts } from "@/app/actions/application";
import { ApplicationQueue } from "@/components/applications/ApplicationQueue";
import { SendingStatusBar } from "@/components/applications/SendingStatusBar";
import { getSendingStats } from "@/lib/send-limiter";
import { getAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const userId = await getAuthUserId();
  const [applications, counts, sendingStats] = await Promise.all([
    getApplications(),
    getApplicationCounts(),
    getSendingStats(userId),
  ]);

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
      <SendingStatusBar
        sentToday={sendingStats.todaySent}
        maxPerDay={sendingStats.todayMax}
        sentThisHour={sendingStats.hourSent}
        maxPerHour={sendingStats.hourMax}
        isPaused={sendingStats.isPaused}
      />
      <ApplicationQueue
        applications={applications}
        counts={counts}
      />
    </div>
  );
}
