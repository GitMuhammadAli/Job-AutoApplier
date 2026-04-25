import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scraper Health · JobPilot",
};

interface SourceState {
  source: string;
  lastStatus: string;
  lastJobsFound: number;
  lastErrorMessage: string | null;
  lastTriedAt: Date | null;
  totalRunsLast24h: number;
  successesLast24h: number;
  zerosLast24h: number;
  errorsLast24h: number;
}

const ALL_SOURCES = [
  "jsearch",
  "indeed",
  "remotive",
  "arbeitnow",
  "adzuna",
  "linkedin",
  "linkedin_posts",
  "rozee",
  "google",
];

const FIX_GUIDES: Record<string, { docs: string; cause: string; fix: string }> = {
  jsearch: {
    cause: "Most likely missing/expired RAPIDAPI_KEY or daily quota hit (RapidAPI free tier).",
    fix: "Get a free key at rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch and set RAPIDAPI_KEY in your Vercel project env vars.",
    docs: "https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch",
  },
  indeed: {
    cause: "Same RAPIDAPI_KEY as jsearch — sources share the key.",
    fix: "Same key as jsearch. If jsearch works but indeed doesn't, the daily endpoint quota is split — upgrade plan or rotate keys.",
    docs: "https://rapidapi.com/letscrape-6bRBa3QguO5/api/indeed12",
  },
  remotive: {
    cause: "Remotive's API only carries remote tech roles (DevOps, ML, design, frontend). Empty for non-tech keywords or in-office roles.",
    fix: "If you want results: use keywords like 'react', 'devops', 'data scientist'. Remotive is genuinely empty for niche or in-person roles — not a bug.",
    docs: "https://remotive.com/api/remote-jobs",
  },
  arbeitnow: {
    cause: "Arbeitnow indexes Germany/EU jobs. Returns 0 if your keywords/locations don't match EU-region postings.",
    fix: "Useful only if you're targeting Germany/Berlin/EU. Otherwise mark this source quiet — it's working, just not for you.",
    docs: "https://arbeitnow.com/api/job-board-api",
  },
  adzuna: {
    cause: "Probably missing ADZUNA_APP_ID or ADZUNA_APP_KEY in env vars, or the country code isn't covered.",
    fix: "Sign up at developer.adzuna.com (free tier = 250 calls/day), set both env vars in Vercel, redeploy.",
    docs: "https://developer.adzuna.com/",
  },
  linkedin: {
    cause: "LinkedIn aggressively blocks datacenter IPs (Vercel/Render). Returns captcha/authwall most days.",
    fix: "Two real fixes: (1) connect your LinkedIn account in Settings to use your session cookies, or (2) install the browser extension (when shipped) to scrape from your own browser.",
    docs: "https://www.linkedin.com/legal/professional-community-policies",
  },
  linkedin_posts: {
    cause: "Uses SerpAPI to find LinkedIn 'hiring' posts. Capped at ~3 results by SerpAPI's structure for this query type.",
    fix: "Set SERPAPI_KEY (100 searches/mo free at serpapi.com). Caps mean you'll never get a flood here — supplement with the main linkedin source.",
    docs: "https://serpapi.com/google-search-api",
  },
  rozee: {
    cause: "Rozee.pk is Pakistan/MENA-focused. Returns 0 for global roles posted only on US/EU boards.",
    fix: "Useful for Pakistan/Middle East jobs. Quiet for global roles is expected — not a bug.",
    docs: "https://www.rozee.pk/",
  },
  google: {
    cause: "SerpAPI Google Jobs scraper. Needs SERPAPI_KEY. Returns 0 if quota exhausted (100/mo free).",
    fix: "Same SERPAPI_KEY as linkedin_posts. Upgrade SerpAPI plan or accept 100/mo cap.",
    docs: "https://serpapi.com/google-jobs-api",
  },
};

async function getSourceStates(): Promise<SourceState[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const runs = await prisma.scraperRun.findMany({
    where: { startedAt: { gte: since } },
    orderBy: [{ source: "asc" }, { startedAt: "desc" }],
    select: {
      source: true,
      status: true,
      jobsFound: true,
      errorMessage: true,
      startedAt: true,
    },
    take: 500,
  });

  const bySource = new Map<string, typeof runs>();
  runs.forEach((r) => {
    if (!bySource.has(r.source)) bySource.set(r.source, []);
    bySource.get(r.source)!.push(r);
  });

  return ALL_SOURCES.map((source) => {
    const sourceRuns = bySource.get(source) || [];
    const last = sourceRuns[0];
    return {
      source,
      lastStatus: last?.status || "no_runs",
      lastJobsFound: last?.jobsFound ?? 0,
      lastErrorMessage: last?.errorMessage || null,
      lastTriedAt: last?.startedAt || null,
      totalRunsLast24h: sourceRuns.length,
      successesLast24h: sourceRuns.filter(
        (r) => r.status === "success" && r.jobsFound > 0,
      ).length,
      zerosLast24h: sourceRuns.filter((r) => r.jobsFound === 0).length,
      errorsLast24h: sourceRuns.filter(
        (r) => r.status === "failed" || r.status === "timeout",
      ).length,
    };
  });
}

function statusFor(s: SourceState): "ok" | "quiet" | "broken" | "missing" {
  if (s.totalRunsLast24h === 0) return "missing";
  if (s.errorsLast24h > 0 && s.errorsLast24h >= s.totalRunsLast24h / 2) return "broken";
  if (s.successesLast24h === 0) return "quiet";
  return "ok";
}

export default async function ScraperHealthPage() {
  await getAuthUserId(); // 401 if not signed in
  const states = await getSourceStates();
  const counts = {
    ok: states.filter((s) => statusFor(s) === "ok").length,
    quiet: states.filter((s) => statusFor(s) === "quiet").length,
    broken: states.filter((s) => statusFor(s) === "broken").length,
    missing: states.filter((s) => statusFor(s) === "missing").length,
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 mb-2"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Settings
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
          Scraper Health
        </h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          Per-source status from the last 24 hours of runs. If you&apos;re seeing fewer jobs than expected, the cause is here.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryCard label="Healthy" count={counts.ok} tone="ok" />
        <SummaryCard label="Quiet" count={counts.quiet} tone="quiet" />
        <SummaryCard label="Broken" count={counts.broken} tone="broken" />
        <SummaryCard label="Not running" count={counts.missing} tone="missing" />
      </div>

      <div className="space-y-2">
        {states.map((s) => (
          <SourceRow key={s.source} state={s} status={statusFor(s)} />
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "ok" | "quiet" | "broken" | "missing";
}) {
  const styles = {
    ok: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-900/40",
    quiet: "bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 ring-slate-200 dark:ring-zinc-700",
    broken: "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-900/40",
    missing: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-900/40",
  }[tone];
  return (
    <div className={`rounded-xl px-3 py-2 ring-1 ${styles}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold tabular-nums">{count}</p>
    </div>
  );
}

function SourceRow({
  state,
  status,
}: {
  state: SourceState;
  status: "ok" | "quiet" | "broken" | "missing";
}) {
  const Icon =
    status === "ok"
      ? CheckCircle2
      : status === "broken"
        ? XCircle
        : AlertTriangle;
  const iconCls = {
    ok: "text-emerald-500",
    quiet: "text-slate-400 dark:text-zinc-500",
    broken: "text-red-500",
    missing: "text-amber-500",
  }[status];
  const label = {
    ok: "Healthy",
    quiet: "Quiet (no matches)",
    broken: "Broken",
    missing: "Not running",
  }[status];
  const guide = FIX_GUIDES[state.source];

  return (
    <details className="rounded-xl bg-white dark:bg-zinc-900 ring-1 ring-slate-200/60 dark:ring-zinc-700/50 overflow-hidden group">
      <summary className="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 list-none">
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`h-4 w-4 shrink-0 ${iconCls}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 capitalize truncate">
              {state.source.replace(/_/g, " ")}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
              {label} · {state.totalRunsLast24h} runs/24h · last: {state.lastStatus} · {state.lastJobsFound} jobs
            </p>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0 hidden sm:block">
          {state.successesLast24h}/{state.totalRunsLast24h} OK
        </div>
      </summary>

      {guide && (
        <div className="p-4 border-t border-slate-100 dark:border-zinc-800 space-y-3 text-xs">
          <div>
            <p className="font-semibold text-slate-700 dark:text-zinc-200">Likely cause</p>
            <p className="text-slate-600 dark:text-zinc-400 mt-0.5 leading-relaxed">{guide.cause}</p>
          </div>
          <div>
            <p className="font-semibold text-slate-700 dark:text-zinc-200">How to fix</p>
            <p className="text-slate-600 dark:text-zinc-400 mt-0.5 leading-relaxed">{guide.fix}</p>
          </div>
          {state.lastErrorMessage && (
            <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/60 p-2.5 border border-slate-200/60 dark:border-zinc-700/50">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Last error
              </p>
              <p className="font-mono text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 break-words">
                {state.lastErrorMessage}
              </p>
            </div>
          )}
          <a
            href={guide.docs}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            <ExternalLink className="h-3 w-3" />
            Open docs
          </a>
        </div>
      )}
    </details>
  );
}
