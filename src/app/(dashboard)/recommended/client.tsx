"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  Building2,
  MapPin,
  Clock,
  ExternalLink,
  Briefcase,
  Star,
  Filter,
  ChevronDown,
  Mail,
  FileText,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { PlatformBadge } from "@/components/shared/PlatformBadge";
import { daysAgo } from "@/lib/utils";
import type { UserJobWithGlobal } from "@/store/useJobStore";

interface Props {
  jobs: UserJobWithGlobal[];
}

const SORT_OPTIONS = [
  { value: "score", label: "Match Score" },
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "company", label: "Company A-Z" },
] as const;

function getScoreColor(score: number) {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-slate-500 dark:text-zinc-400";
}

function getScoreBg(score: number) {
  if (score >= 70) return "bg-emerald-500 dark:bg-emerald-400";
  if (score >= 50) return "bg-amber-400 dark:bg-amber-500";
  return "bg-slate-300 dark:bg-zinc-600";
}

function getStatusBadge(status: string | undefined) {
  switch (status) {
    case "SENT":
      return { label: "Applied", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" };
    case "DRAFT":
      return { label: "Draft", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" };
    case "READY":
      return { label: "Queued", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" };
    case "SENDING":
      return { label: "Sending", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" };
    case "FAILED":
      return { label: "Failed", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" };
    case "CANCELLED":
      return { label: "Cancelled", cls: "bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300" };
    case "BOUNCED":
      return { label: "Bounced", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" };
    default:
      return null;
  }
}

export function RecommendedClient({ jobs }: Props) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]["value"]>("score");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const sources = useMemo(() => {
    const s = new Set(jobs.map((j) => j.globalJob.source));
    return Array.from(s).sort();
  }, [jobs]);

  const stages = useMemo(() => {
    const s = new Set(jobs.map((j) => j.stage));
    return Array.from(s).sort();
  }, [jobs]);

  const filtered = useMemo(() => {
    let result = jobs;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (j) =>
          j.globalJob.title.toLowerCase().includes(q) ||
          j.globalJob.company.toLowerCase().includes(q) ||
          (j.globalJob.location?.toLowerCase().includes(q)) ||
          (j.globalJob.category?.toLowerCase().includes(q)) ||
          j.globalJob.skills?.some((s) => s.toLowerCase().includes(q))
      );
    }

    if (sourceFilter) {
      result = result.filter((j) => j.globalJob.source === sourceFilter);
    }

    if (stageFilter) {
      result = result.filter((j) => j.stage === stageFilter);
    }

    switch (sort) {
      case "score":
        result = [...result].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
        break;
      case "newest":
        result = [...result].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case "oldest":
        result = [...result].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case "company":
        result = [...result].sort((a, b) =>
          a.globalJob.company.localeCompare(b.globalJob.company)
        );
        break;
    }

    return result;
  }, [jobs, search, sort, sourceFilter, stageFilter]);

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Recommended Jobs
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            All matched jobs with details — click any card to view and apply.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 ring-1 ring-blue-100 dark:ring-blue-900/40">
            <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-blue-700 dark:text-blue-300 tabular-nums">
              {filtered.length} job{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Search + filters bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, company, skill, location..."
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              showFilters
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 rounded-xl bg-white dark:bg-zinc-800/50 p-4 ring-1 ring-slate-100 dark:ring-zinc-700/60">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 block">
              <Filter className="h-3 w-3 inline mr-1" />Source
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSourceFilter(null)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  !sourceFilter
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600"
                }`}
              >
                All
              </button>
              {sources.map((s) => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(sourceFilter === s ? null : s)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    sourceFilter === s
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 block">
              Stage
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setStageFilter(null)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  !stageFilter
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600"
                }`}
              >
                All
              </button>
              {stages.map((s) => (
                <button
                  key={s}
                  onClick={() => setStageFilter(stageFilter === s ? null : s)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    stageFilter === s
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600"
                  }`}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Job cards grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 p-8 md:p-12 text-center">
          <Briefcase className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-200">No jobs match your filters</h3>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((job) => (
            <JobDetailCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobDetailCard({ job }: { job: UserJobWithGlobal }) {
  const g = job.globalJob;
  const days = daysAgo(g.postedDate ?? null);
  const score = job.matchScore ?? 0;
  const status = getStatusBadge(job.application?.status);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block rounded-xl bg-white dark:bg-zinc-800 p-4 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:ring-slate-200/80 dark:hover:ring-zinc-600/80"
    >
      {/* Header: company + score */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500 min-w-0">
          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate font-medium">{g.company}</span>
        </div>
        {score > 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-sm font-bold tabular-nums ${getScoreColor(score)}`}>
              {Math.round(score)}%
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-2 line-clamp-2">
        {g.title}
      </h3>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <PlatformBadge source={g.source} />
        {status && (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${status.cls}`}>
            {status.label === "Applied" && <Mail className="h-2.5 w-2.5" />}
            {status.label === "Draft" && <FileText className="h-2.5 w-2.5" />}
            {status.label}
          </span>
        )}
        {days !== null && days <= 1 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            Fresh
          </span>
        )}
        {g.jobType && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400 capitalize">
            {g.jobType}
          </span>
        )}
      </div>

      {/* Match progress bar */}
      {score > 0 && (
        <div className="mb-3">
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-zinc-700">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${getScoreBg(score)}`}
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>
          {job.matchReasons && job.matchReasons.length > 0 && (
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 line-clamp-2">
              {job.matchReasons.slice(0, 4).join(" · ")}
            </p>
          )}
        </div>
      )}

      {/* Salary */}
      {g.salary && (
        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-2 truncate">
          {g.salary}
        </div>
      )}

      {/* Skills */}
      {g.skills && g.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {(g.skills as string[]).slice(0, 5).map((skill) => (
            <span
              key={skill}
              className="rounded bg-slate-100 dark:bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-zinc-300"
            >
              {skill}
            </span>
          ))}
          {(g.skills as string[]).length > 5 && (
            <span className="text-[10px] text-slate-400 dark:text-zinc-500">
              +{(g.skills as string[]).length - 5}
            </span>
          )}
        </div>
      )}

      {/* Description snippet */}
      {g.description && (
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 line-clamp-2 mb-3 leading-relaxed">
          {g.description.replace(/<[^>]+>/g, "").slice(0, 200)}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-zinc-700/50">
        <div className="flex items-center gap-2 min-w-0 text-[11px] text-slate-400 dark:text-zinc-500">
          {g.location && (
            <div className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{g.location}</span>
            </div>
          )}
          {days !== null && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Clock className="h-2.5 w-2.5" />
              <span>{days === 0 ? "Today" : `${days}d ago`}</span>
            </div>
          )}
        </div>

        {g.applyUrl && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 group-hover:text-blue-600 dark:text-blue-400 dark:group-hover:text-blue-300">
            View <ExternalLink className="h-2.5 w-2.5" />
          </span>
        )}
      </div>

      {/* Stage badge */}
      <div className="mt-2">
        <span className={`inline-block rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
          job.stage === "SAVED" ? "bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400" :
          job.stage === "APPLIED" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
          job.stage === "INTERVIEW" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" :
          job.stage === "OFFER" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
          "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
        }`}>
          {job.stage}
        </span>
      </div>
    </Link>
  );
}
