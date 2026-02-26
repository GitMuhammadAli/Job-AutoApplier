"use client";

import { useState, useTransition, useMemo, useCallback, useRef, useEffect, memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Building2,
  MapPin,
  Clock,
  ExternalLink,
  Briefcase,
  Star,
  Filter,
  Sparkles,
  Mail,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Globe,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { PlatformBadge } from "@/components/shared/PlatformBadge";
import { daysAgo } from "@/lib/utils";
import { saveGlobalJob, dismissGlobalJob, bulkDismissBelowScore } from "@/app/actions/job";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { RecommendedJob, RecommendationResult } from "@/lib/matching/recommendation-engine";

interface Props {
  jobs: RecommendedJob[];
  total: number;
  page: number;
  pageSize: number;
  timing: RecommendationResult["timing"];
  sourceCounts: Record<string, number>;
  filterBreakdown: RecommendationResult["filterBreakdown"];
  currentFilters: {
    source: string | null;
    sort: string;
    minScore: string;
    location: string | null;
    type: string | null;
    email: string | null;
    q: string | null;
  };
}

const SCORE_PRESETS = [
  { value: "0", label: "All" },
  { value: "40", label: "40+" },
  { value: "60", label: "60+" },
  { value: "80", label: "80+" },
];

const LOCATION_PRESETS = [
  { value: "", label: "My City" },
  { value: "country", label: "My Country" },
  { value: "remote", label: "Remote" },
  { value: "all", label: "All" },
];

function getScoreColor(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-teal-600 dark:text-teal-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  if (score >= 20) return "text-orange-600 dark:text-orange-400";
  return "text-slate-500 dark:text-zinc-400";
}

function getScoreBg(score: number) {
  if (score >= 80) return "bg-emerald-500 dark:bg-emerald-400";
  if (score >= 60) return "bg-teal-500 dark:bg-teal-400";
  if (score >= 40) return "bg-amber-400 dark:bg-amber-500";
  if (score >= 20) return "bg-orange-400 dark:bg-orange-500";
  return "bg-slate-300 dark:bg-zinc-600";
}

function getStatusBadge(status: string | null) {
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
    case "BOUNCED":
      return { label: "Bounced", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" };
    default:
      return null;
  }
}

export function RecommendedClient({
  jobs,
  total,
  page,
  pageSize,
  timing,
  sourceCounts,
  filterBreakdown,
  currentFilters,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(currentFilters.q || "");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.ceil(total / pageSize);

  const buildUrl = useCallback((overrides: Record<string, string | null>) => {
    const merged = { ...currentFilters, ...overrides };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (!v || (k === "minScore" && v === "0") || (k === "sort" && v === "score") || (k === "page" && v === "1")) {
        continue;
      }
      params.set(k, v);
    }
    const qs = params.toString();
    return `/recommended${qs ? `?${qs}` : ""}`;
  }, [currentFilters]);

  const updateFilter = useCallback((key: string, value: string | null) => {
    const overrides: Record<string, string | null> = { [key]: value };
    if (key !== "page") overrides.page = null;
    startTransition(() => {
      router.push(buildUrl(overrides));
    });
  }, [buildUrl, router]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    updateFilter("q", searchInput.trim() || null);
  }, [searchInput, updateFilter]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const trimmed = val.trim();
      if (trimmed.length >= 3 || trimmed.length === 0) {
        updateFilter("q", trimmed || null);
      }
    }, 400);
  }, [updateFilter]);

  useEffect(() => {
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    updateFilter("q", null);
  }, [updateFilter]);

  const activeSources = useMemo(() => (currentFilters.source || "").split(",").filter(Boolean), [currentFilters.source]);
  const sortedSources = useMemo(() => Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]), [sourceCounts]);
  const visibleJobs = useMemo(() => jobs.filter((j) => !dismissedIds.has(j.id)), [jobs, dismissedIds]);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(Array.from(prev));
      next.add(id);
      return next;
    });
    dismissGlobalJob(id);
  }, []);

  return (
    <div className={`space-y-4 ${isPending ? "opacity-70 pointer-events-none" : ""}`}>
      {/* Stats bar */}
      <div className="flex items-center justify-between text-xs">
        <p className="text-slate-500 dark:text-zinc-400">
          Matched from {filterBreakdown.sqlCandidates.toLocaleString()} candidates in {timing.totalMs}ms
        </p>
        <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 ring-1 ring-blue-100 dark:ring-blue-900/40">
          <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold text-blue-700 dark:text-blue-300 tabular-nums">
            {total} job{total !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <Input
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search jobs..."
            className="pl-9 pr-8 h-9 text-sm"
          />
          {searchInput && (
            <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300" />
            </button>
          )}
        </form>

        <select
          value={currentFilters.sort}
          onChange={(e) => updateFilter("sort", e.target.value === "score" ? null : e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="score">Best Match</option>
          <option value="date">Newest First</option>
        </select>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-3 rounded-xl bg-white dark:bg-zinc-800/50 p-3 ring-1 ring-slate-100 dark:ring-zinc-700/60">
        {/* Sources */}
        <div className="w-full sm:w-auto">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 block">
            <Filter className="h-3 w-3 inline mr-1" />Source
          </span>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => updateFilter("source", null)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                activeSources.length === 0
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600"
              }`}
            >
              All
            </button>
            {sortedSources.map(([source, count]) => {
              const active = activeSources.includes(source);
              return (
                <button
                  key={source}
                  onClick={() => {
                    const newSources = active
                      ? activeSources.filter((s) => s !== source)
                      : [...activeSources, source];
                    updateFilter("source", newSources.length > 0 ? newSources.join(",") : null);
                  }}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600"
                  }`}
                >
                  {source} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Score filter */}
        <div>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 block">
            <Star className="h-3 w-3 inline mr-1" />Score
          </span>
          <div className="flex gap-1">
            {SCORE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => updateFilter("minScore", p.value === "0" ? null : p.value)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  (currentFilters.minScore || "0") === p.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Location filter */}
        <div>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 block">
            <MapPin className="h-3 w-3 inline mr-1" />Location
          </span>
          <div className="flex gap-1">
            {LOCATION_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => updateFilter("location", p.value || null)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  (currentFilters.location || "") === p.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Has Email toggle */}
        <div>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 block">
            <Mail className="h-3 w-3 inline mr-1" />Email
          </span>
          <button
            onClick={() => updateFilter("email", currentFilters.email === "true" ? null : "true")}
            className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
              currentFilters.email === "true"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600"
            }`}
          >
            Has Email
          </button>
        </div>
      </div>

      {/* Results */}
      {visibleJobs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 p-8 md:p-12 text-center">
          <Briefcase className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-200">No jobs match your filters</h3>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
            Try adjusting your search, lowering the score threshold, or changing location filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => updateFilter("page", String(page - 1))}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <span className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => updateFilter("page", String(page + 1))}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

const JobCard = memo(function JobCard({ job, onDismiss }: { job: RecommendedJob; onDismiss: (id: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!job.userJobId);

  const days = daysAgo(job.postedDate ?? null);
  const score = job.matchScore;
  const status = getStatusBadge(job.applicationStatus);
  const detailUrl = job.userJobId ? `/jobs/${job.userJobId}` : `/jobs/${job.id}`;

  const handleSave = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saved || saving) return;
    setSaving(true);
    const result = await saveGlobalJob(job.id);
    setSaving(false);
    if (result.success) setSaved(true);
  }, [saved, saving, job.id]);

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDismiss(job.id);
  }, [onDismiss, job.id]);

  const handleViewExternal = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = job.applyUrl || job.sourceUrl;
    if (url) window.open(url, "_blank");
  }, [job.applyUrl, job.sourceUrl]);

  return (
    <div className="group block rounded-xl bg-white dark:bg-zinc-800 p-4 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 transition-all duration-200 hover:shadow-md hover:ring-slate-200/80 dark:hover:ring-zinc-600/80">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500 min-w-0">
          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate font-medium">{job.company}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0" title="Match score based on keywords, skills, location, and freshness">
          <span className={`text-sm font-bold tabular-nums ${getScoreColor(score)}`}>
            {Math.round(score)}%
          </span>
        </div>
      </div>

      {/* Title */}
      <Link href={detailUrl}>
        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-2 line-clamp-2 cursor-pointer">
          {job.title}
        </h3>
      </Link>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <PlatformBadge source={job.source} />
        {status && (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${status.cls}`}>
            {status.label === "Applied" && <Mail className="h-2.5 w-2.5" />}
            {status.label === "Draft" && <FileText className="h-2.5 w-2.5" />}
            {status.label}
          </span>
        )}
        {job.isRemote && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
            <Globe className="h-2.5 w-2.5 inline mr-0.5" />Remote
          </span>
        )}
        {days !== null && days <= 1 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            Fresh
          </span>
        )}
        {job.companyEmail ? (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            (job.emailConfidence ?? 0) >= 70
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          }`}>
            <Mail className="h-2.5 w-2.5 inline mr-0.5" />
            {(job.emailConfidence ?? 0) >= 70 ? "Email" : "Email?"}
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400">
            No Email
          </span>
        )}
      </div>

      {/* Score bar */}
      <div className="mb-2">
        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-zinc-700">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${getScoreBg(score)}`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        {job.matchReasons.length > 0 && (
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 line-clamp-2">
            {job.matchReasons.slice(0, 3).join(" \u00B7 ")}
          </p>
        )}
      </div>

      {/* Salary */}
      {job.salary && (
        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-2 truncate">
          {job.salary}
        </div>
      )}

      {/* Skills */}
      {job.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {job.skills.slice(0, 4).map((skill) => (
            <span key={skill} className="rounded bg-slate-100 dark:bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-zinc-300">
              {skill}
            </span>
          ))}
          {job.skills.length > 4 && (
            <span className="text-[10px] text-slate-400 dark:text-zinc-500">+{job.skills.length - 4}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-zinc-700/50 mb-2">
        <div className="flex items-center gap-2 min-w-0 text-[11px] text-slate-400 dark:text-zinc-500">
          {job.location && (
            <div className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{job.location}</span>
            </div>
          )}
          {days !== null && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Clock className="h-2.5 w-2.5" />
              <span>{days === 0 ? "Today" : `${days}d ago`}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {(job.applyUrl || job.sourceUrl) && (
          <button
            onClick={handleViewExternal}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <ExternalLink className="h-3 w-3" /> Apply
          </button>
        )}

        {job.companyEmail && (job.emailConfidence ?? 0) >= 70 && (
          <Link
            href={`${detailUrl}?apply=true`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors"
          >
            <Mail className="h-3 w-3" /> Email
          </Link>
        )}

        <button
          onClick={handleSave}
          disabled={saved || saving}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
            saved
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
          }`}
        >
          <Bookmark className="h-3 w-3" />
          {saved ? "Saved" : saving ? "..." : "Save"}
        </button>

        <button
          onClick={handleDismiss}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-300 transition-colors ml-auto"
        >
          <X className="h-3 w-3" /> Dismiss
        </button>
      </div>
    </div>
  );
});
