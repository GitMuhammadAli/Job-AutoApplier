"use client";

import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Shield,
  AlertCircle,
  Ban,
} from "lucide-react";

interface DeliveryStatsProps {
  stats: {
    thisWeek: {
      sent: number;
      bounced: number;
      failed: number;
      draft: number;
      delivered: number;
      emailApps: number;
      siteApps: number;
      total: number;
      deliveryRate: number;
    };
    prevWeek: { deliveryRate: number };
    todayMatches: number;
    emailAvailability: {
      verified: number;
      unverified: number;
      none: number;
      total: number;
    };
  };
}

export function DeliveryStats({ stats }: DeliveryStatsProps) {
  const { thisWeek, prevWeek, todayMatches, emailAvailability } = stats;

  const rateChange = thisWeek.deliveryRate - prevWeek.deliveryRate;
  const hasActivity = thisWeek.total > 0 || todayMatches > 0;

  if (!hasActivity && emailAvailability.total === 0) return null;

  return (
    <div className="rounded-xl bg-white dark:bg-zinc-800/80 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 p-4">
      <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-3 flex items-center gap-1.5">
        <Mail className="h-4 w-4 text-blue-500" />
        Application Stats
        <span className="text-[10px] font-normal text-slate-400 dark:text-zinc-500 ml-auto">This week</span>
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <StatCard
          label="Sent"
          value={thisWeek.sent}
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
          color="emerald"
        />
        <StatCard
          label="Bounced"
          value={thisWeek.bounced}
          icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          color="amber"
        />
        <StatCard
          label="Failed"
          value={thisWeek.failed}
          icon={<XCircle className="h-3.5 w-3.5 text-red-500" />}
          color="red"
        />
        <StatCard
          label="Drafts"
          value={thisWeek.draft}
          icon={<FileText className="h-3.5 w-3.5 text-blue-500" />}
          color="blue"
        />
      </div>

      {/* Delivery rate + channels */}
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        {(thisWeek.sent + thisWeek.bounced > 0) && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-zinc-400">Delivery:</span>
            <span className={`font-bold tabular-nums ${
              thisWeek.deliveryRate >= 80
                ? "text-emerald-600 dark:text-emerald-400"
                : thisWeek.deliveryRate >= 50
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
            }`}>
              {thisWeek.deliveryRate}%
            </span>
            {rateChange !== 0 && (
              <span className={`flex items-center gap-0.5 ${
                rateChange > 0 ? "text-emerald-500" : "text-red-500"
              }`}>
                {rateChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(rateChange)}%
              </span>
            )}
          </div>
        )}

        {thisWeek.emailApps > 0 && (
          <span className="text-slate-400 dark:text-zinc-500">
            <Mail className="h-3 w-3 inline mr-0.5" />
            {thisWeek.emailApps} via email
          </span>
        )}
        {thisWeek.siteApps > 0 && (
          <span className="text-slate-400 dark:text-zinc-500">
            <ExternalLink className="h-3 w-3 inline mr-0.5" />
            {thisWeek.siteApps} via site
          </span>
        )}
        {todayMatches > 0 && (
          <span className="text-blue-500 dark:text-blue-400 font-medium">
            {todayMatches} new today
          </span>
        )}
      </div>

      {/* Email availability */}
      {emailAvailability.total > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-700/60">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
            Email Availability ({emailAvailability.total} matched jobs)
          </span>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Shield className="h-3 w-3" />
              {emailAvailability.verified} verified
            </span>
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              {emailAvailability.unverified} unverified
            </span>
            <span className="flex items-center gap-1 text-slate-400 dark:text-zinc-500">
              <Ban className="h-3 w-3" />
              {emailAvailability.none} no email
            </span>
          </div>
          {emailAvailability.total > 0 && (
            <div className="mt-1.5 flex h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-zinc-700">
              {emailAvailability.verified > 0 && (
                <div
                  className="bg-emerald-500 dark:bg-emerald-400"
                  style={{ width: `${(emailAvailability.verified / emailAvailability.total) * 100}%` }}
                />
              )}
              {emailAvailability.unverified > 0 && (
                <div
                  className="bg-amber-400 dark:bg-amber-500"
                  style={{ width: `${(emailAvailability.unverified / emailAvailability.total) * 100}%` }}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-lg p-2.5 bg-slate-50/80 dark:bg-zinc-800/50 ring-1 ring-slate-100/60 dark:ring-zinc-700/40">
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon}
        <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">{label}</span>
      </div>
      <span className="text-lg font-bold text-slate-800 dark:text-zinc-100 tabular-nums">{value}</span>
    </div>
  );
}
