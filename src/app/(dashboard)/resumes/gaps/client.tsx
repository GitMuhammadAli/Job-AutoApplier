"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, TrendingUp, XCircle } from "lucide-react";
import type { KeywordGapAnalysis, KeywordGapEntry } from "@/lib/resume/keyword-gaps";

export function GapsClient({ analysis }: { analysis: KeywordGapAnalysis }) {
  const { jobCount, entries, summary } = analysis;
  const maxCount = entries[0]?.jobCount ?? 1;

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <SummaryBanner jobCount={jobCount} summary={summary} maxCount={maxCount} />

      {entries.length === 0 ? (
        <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 text-emerald-600" size={24} />
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            No keyword gaps across your shortlist
          </p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">
            Your profile covers every keyword the analyzed JDs asked for. Add
            more jobs to your shortlist to surface new gaps.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Top missing keywords · ranked by jobs blocked
            </p>
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {entries.map((entry, idx) => (
              <GapRow key={entry.keyword} entry={entry} maxCount={maxCount} rank={idx + 1} />
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center">
        Analysis spans your last {jobCount} non-dismissed jobs (saved + recommended +
        applied). Counts update as your shortlist evolves.
      </p>
    </div>
  );
}

function SummaryBanner({
  jobCount,
  summary,
  maxCount,
}: {
  jobCount: number;
  summary: KeywordGapAnalysis["summary"];
  maxCount: number;
}) {
  const avgPct = Math.round(summary.avgCoverage * 100);
  const topImpactPct = summary.topImpact
    ? Math.round((summary.topImpact.jobs / jobCount) * 100)
    : 0;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Jobs analyzed" value={jobCount.toString()} />
        <Stat
          label="Avg ATS coverage"
          value={`${avgPct}%`}
          tone={avgPct >= 70 ? "ok" : avgPct >= 50 ? "warn" : "bad"}
        />
        <Stat label="Distinct gaps" value={summary.distinctMissing.toString()} />
      </div>

      {summary.topImpact && (
        <div className="mt-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 p-3 flex items-start gap-3">
          <TrendingUp className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" size={14} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              Top-leverage move:{" "}
              <span className="font-bold">{summary.topImpact.keyword}</span>
            </p>
            <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/90 mt-0.5">
              Honestly adding this to your profile would unlock{" "}
              <strong>{summary.topImpact.jobs} of your {jobCount} jobs</strong>{" "}
              ({topImpactPct}%).
              {summary.topImpact.adjacent && (
                <>
                  {" "}
                  You already have related experience — see the row below.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
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
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function GapRow({
  entry,
  maxCount,
  rank,
}: {
  entry: KeywordGapEntry;
  maxCount: number;
  rank: number;
}) {
  const [expanded, setExpanded] = useState(rank <= 1);
  const widthPct = Math.max(8, (entry.jobCount / maxCount) * 100);

  return (
    <li className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
      >
        <span className="text-[10px] font-bold tabular-nums text-zinc-400 dark:text-zinc-500 w-5 mt-0.5">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {entry.keyword}
            </span>
            {entry.hasAdjacency ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                related experience
              </span>
            ) : (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                cold
              </span>
            )}
            <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400 ml-auto">
              {entry.jobCount} {entry.jobCount === 1 ? "job" : "jobs"}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${entry.hasAdjacency ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${widthPct}%` }}
            />
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="text-zinc-400 shrink-0 mt-0.5" size={14} />
        ) : (
          <ChevronRight className="text-zinc-400 shrink-0 mt-0.5" size={14} />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-12 space-y-3 text-xs">
          {entry.hasAdjacency ? (
            <div className="rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 p-2.5">
              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200 mb-1.5">
                You have related experience — worth mentioning where honest:
              </p>
              <div className="flex flex-wrap gap-1">
                {entry.adjacentSkills.slice(0, 8).map((s) => (
                  <span
                    key={s}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded ring-1 ring-inset bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 ring-amber-300/40"
                  >
                    {s}
                  </span>
                ))}
                {entry.adjacentProjectIds.length > 0 && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-300">
                    + {entry.adjacentProjectIds.length} project
                    {entry.adjacentProjectIds.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-red-50/60 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40 p-2.5 flex items-start gap-2">
              <XCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={12} />
              <p className="text-[11px] text-red-700 dark:text-red-300">
                Cold — no adjacent experience in your profile. If you can
                honestly learn this in a weekend (one project, one repo), it
                unlocks {entry.jobCount}{" "}
                {entry.jobCount === 1 ? "application" : "applications"}.
              </p>
            </div>
          )}

          {entry.sampleJobs.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                Sample jobs asking for it
              </p>
              <ul className="space-y-0.5">
                {entry.sampleJobs.slice(0, 5).map((j, i) => (
                  <li key={i} className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                    · <span className="font-medium">{j.title}</span>
                    <span className="text-zinc-400 dark:text-zinc-500"> @ {j.company}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
