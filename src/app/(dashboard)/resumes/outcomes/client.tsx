"use client";

import { Trophy, CheckCircle2, XCircle, Clock } from "lucide-react";
import type {
  OutcomeAnalysis,
  TemplateBreakdown,
  CoverageBucketBreakdown,
} from "@/lib/resume/outcome-analytics";

export function OutcomesClient({ analysis }: { analysis: OutcomeAnalysis }) {
  return (
    <div className="space-y-4">
      <RollupBanner analysis={analysis} />
      <WinnersPanel analysis={analysis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownTable
          title="By template"
          rows={analysis.byTemplate.map((t) => ({
            key: t.templateId,
            label: t.templateId,
            ...t,
          }))}
        />
        <BreakdownTable
          title="By ATS keyword coverage"
          rows={analysis.byCoverage.map((c) => ({
            key: c.bucket,
            label: c.bucket,
            ...c,
          }))}
        />
      </div>
    </div>
  );
}

function RollupBanner({ analysis }: { analysis: OutcomeAnalysis }) {
  const decisive = analysis.outcomes.positive + analysis.outcomes.negative;
  const callbackRate = decisive === 0 ? null : analysis.outcomes.positive / decisive;
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Stat label="Total sent" value={analysis.totalSent.toString()} />
      <Stat
        label="Callbacks"
        value={`${analysis.outcomes.positive}`}
        icon={<CheckCircle2 size={12} />}
        tone="ok"
      />
      <Stat
        label="Rejected/Ghosted"
        value={`${analysis.outcomes.negative}`}
        icon={<XCircle size={12} />}
        tone="bad"
      />
      <Stat
        label="Callback rate"
        value={callbackRate === null ? "—" : `${Math.round(callbackRate * 100)}%`}
        tone={
          callbackRate === null
            ? "neutral"
            : callbackRate >= 0.3
              ? "ok"
              : callbackRate >= 0.1
                ? "warn"
                : "bad"
        }
      />
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "bad"
          ? "text-red-600 dark:text-red-400"
          : "text-zinc-900 dark:text-zinc-100";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function WinnersPanel({ analysis }: { analysis: OutcomeAnalysis }) {
  if (!analysis.winningTemplate && !analysis.winningCoverageBucket) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 p-4">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          <Clock size={12} className="inline mr-1" />
          Not enough callback data to call winners yet. Send ≥3 applications
          with at least one positive outcome (INTERVIEW / OFFER) for the system
          to surface what&apos;s working.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {analysis.winningTemplate && (
        <WinnerCard
          icon={<Trophy size={14} />}
          label="Winning template"
          headline={analysis.winningTemplate.templateId}
          detail={`${analysis.winningTemplate.positive}/${analysis.winningTemplate.positive + analysis.winningTemplate.negative} decisive sends got callbacks (${Math.round((analysis.winningTemplate.callbackRate ?? 0) * 100)}%). Default to this one for similar roles.`}
        />
      )}
      {analysis.winningCoverageBucket && (
        <WinnerCard
          icon={<CheckCircle2 size={14} />}
          label="Winning coverage level"
          headline={analysis.winningCoverageBucket.bucket}
          detail={`Applications with this coverage bucket got callbacks ${Math.round((analysis.winningCoverageBucket.callbackRate ?? 0) * 100)}% of the time. Consider skipping jobs whose coverage falls below this.`}
        />
      )}
    </div>
  );
}

function WinnerCard({
  icon,
  label,
  headline,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  headline: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 flex items-start gap-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300">
          {label}
        </p>
        <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100 mt-0.5">
          {headline}
        </p>
        <p className="text-[11px] text-emerald-800/90 dark:text-emerald-200/90 mt-1">{detail}</p>
      </div>
    </div>
  );
}

type BreakdownRow = {
  key: string;
  label: string;
  sent: number;
  positive: number;
  negative: number;
  inFlight: number;
  callbackRate: number | null;
};

function BreakdownTable({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          {title}
        </p>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-zinc-50/50 dark:bg-zinc-900/30">
          <tr className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <th className="text-left px-3 py-2 font-semibold">Label</th>
            <th className="text-right px-3 py-2 font-semibold">Sent</th>
            <th className="text-right px-3 py-2 font-semibold">Callback</th>
            <th className="text-right px-3 py-2 font-semibold">No</th>
            <th className="text-right px-3 py-2 font-semibold">Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((r) => {
            const rate = r.callbackRate;
            const rateCls =
              rate === null
                ? "text-zinc-400"
                : rate >= 0.3
                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                  : rate >= 0.1
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400";
            return (
              <tr key={r.key} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-800/40">
                <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">
                  {r.label}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {r.sent}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {r.positive}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                  {r.negative}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${rateCls}`}>
                  {rate === null ? "—" : `${Math.round(rate * 100)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
