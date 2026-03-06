"use client";

import { useState, useTransition, useMemo, useCallback, useRef, useEffect, memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Building2,
  MapPin,
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
  ArrowUpDown,
  CalendarDays,
  Banknote,
  BarChart2,
  MessageSquare,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { PlatformBadge } from "@/components/shared/PlatformBadge";
import { FreshnessDot } from "@/components/jobs/FreshnessIndicator";
import { saveGlobalJob, dismissGlobalJob, undismissGlobalJob } from "@/app/actions/job";
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

const FRESHNESS_PRESETS = [
  { value: "", label: "Any" },
  { value: "today", label: "Today" },
  { value: "3days", label: "3 Days" },
  { value: "week", label: "This Week" },
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
      return { label: "Undelivered", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" };
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
  const [clientSort, setClientSort] = useState(currentFilters.sort);
  const [freshness, setFreshness] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.ceil(total / pageSize);

  const buildUrl = useCallback((overrides: Record<string, string | null>) => {
    const merged = { ...currentFilters, ...overrides };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (!v || (k === "minScore" && v === "0") || (k === "sort" && v === "score") || (k === "page" && v === "1")) {
        continue;
      }
      let val = v;
      if (k === "sort") {
        if (val === "score_asc") val = "score";
        else if (val === "date_asc") val = "date";
      }
      params.set(k, val);
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
  const visibleJobs = useMemo(() => {
    let filtered = jobs.filter((j) => !dismissedIds.has(j.id));

    if (freshness) {
      const now = Date.now();
      const maxAge: Record<string, number> = {
        today: 1 * 24 * 60 * 60 * 1000,
        "3days": 3 * 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
      };
      const cutoff = maxAge[freshness];
      if (cutoff) {
        filtered = filtered.filter((j) => {
          if (!j.postedDate) return false;
          return now - new Date(j.postedDate).getTime() <= cutoff;
        });
      }
    }

    if (clientSort === "score_asc") {
      filtered = [...filtered].sort((a, b) => a.matchScore - b.matchScore);
    } else if (clientSort === "date_asc") {
      filtered = [...filtered].sort((a, b) => {
        const ta = a.postedDate ? new Date(a.postedDate).getTime() : 0;
        const tb = b.postedDate ? new Date(b.postedDate).getTime() : 0;
        return ta - tb;
      });
    }

    return filtered;
  }, [jobs, dismissedIds, freshness, clientSort]);

  const handleDismiss = useCallback(async (id: string) => {
    const job = jobs.find((j) => j.id === id);
    setDismissedIds((prev) => {
      const next = new Set(Array.from(prev));
      next.add(id);
      return next;
    });
    const result = await dismissGlobalJob(id);
    if (!result.success) {
      setDismissedIds((prev) => {
        const next = new Set(Array.from(prev));
        next.delete(id);
        return next;
      });
      toast.error(result.error || "Failed to dismiss job");
      return;
    }
    toast("Job dismissed", {
      description: job ? `${job.title} at ${job.company}` : undefined,
      action: {
        label: "Undo",
        onClick: async () => {
          setDismissedIds((prev) => {
            const next = new Set(Array.from(prev));
            next.delete(id);
            return next;
          });
          await undismissGlobalJob(id);
        },
      },
      duration: 5000,
    });
  }, [jobs]);

  const emailCounts = useMemo(() => ({
    all: jobs.length,
    verified: jobs.filter((j) => j.companyEmail && (j.emailConfidence ?? 0) >= 80).length,
    none: jobs.filter((j) => !j.companyEmail).length,
  }), [jobs]);

  const hasActiveFilters = useMemo(() => {
    return !!(currentFilters.source || currentFilters.q ||
      (currentFilters.email && currentFilters.email !== "all") ||
      (currentFilters.minScore && currentFilters.minScore !== "0") ||
      currentFilters.location || freshness || (clientSort !== "score" && clientSort !== "date"));
  }, [currentFilters, freshness, clientSort]);

  const resetAllFilters = useCallback(() => {
    setSearchInput("");
    setFreshness("");
    setClientSort("score");
    startTransition(() => {
      router.push("/recommended");
    });
  }, [router]);

  return (
    <div className={`space-y-4 transition-opacity duration-200 ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Stats bar */}
      <div className="flex items-center justify-between text-xs">
        <p className="text-slate-500 dark:text-zinc-400">
          {filterBreakdown.sqlCandidates.toLocaleString()} jobs searched
        </p>
        <div className="flex items-center gap-2">
          {(freshness || clientSort === "score_asc" || clientSort === "date_asc") && visibleJobs.length !== jobs.length && (
            <span className="text-slate-400 dark:text-zinc-500 tabular-nums">
              {visibleJobs.length} shown
            </span>
          )}
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 ring-1 ring-blue-100 dark:ring-blue-900/40">
            <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-blue-700 dark:text-blue-300 tabular-nums">
              {total} job{total !== 1 ? "s" : ""}
            </span>
          </div>
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

        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
          <select
            value={clientSort}
            onChange={(e) => {
              const val = e.target.value;
              setClientSort(val);
              const serverSort = val === "score_asc" ? "score" : val === "date_asc" ? "date" : val;
              updateFilter("sort", serverSort === "score" ? null : serverSort);
            }}
            className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="score">Best Match</option>
            <option value="date">Newest First</option>
            <option value="score_asc">Lowest Match First</option>
            <option value="date_asc">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Filter chips */}
      <div className="rounded-xl bg-white dark:bg-zinc-800/50 p-2.5 sm:p-3 ring-1 ring-slate-100 dark:ring-zinc-700/60 space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-3">
        {/* Sources — horizontal scroll on mobile */}
        <div className="min-w-0">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">
            <Filter className="h-3 w-3 inline mr-1" />Source
          </span>
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5 -mx-0.5 px-0.5">
            <FilterChip active={activeSources.length === 0} onClick={() => updateFilter("source", null)} label="All" />
            {sortedSources.map(([source, count]) => {
              const active = activeSources.includes(source);
              return (
                <FilterChip
                  key={source}
                  active={active}
                  onClick={() => {
                    const newSources = active
                      ? activeSources.filter((s) => s !== source)
                      : [...activeSources, source];
                    updateFilter("source", newSources.length > 0 ? newSources.join(",") : null);
                  }}
                  label={`${source} (${count})`}
                />
              );
            })}
          </div>
        </div>

        {/* Row of small filters — scrollable on mobile */}
        <div className="flex gap-3 overflow-x-auto scrollbar-none pb-0.5">
          {/* Score filter */}
          <div className="shrink-0" title="Higher score = better match for your skills">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">
              <Star className="h-3 w-3 inline mr-1" />Match
            </span>
            <div className="flex gap-1">
              {SCORE_PRESETS.map((p) => (
                <FilterChip
                  key={p.value}
                  active={(currentFilters.minScore || "0") === p.value}
                  onClick={() => updateFilter("minScore", p.value === "0" ? null : p.value)}
                  label={p.label}
                />
              ))}
            </div>
          </div>

          {/* Location filter */}
          <div className="shrink-0">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">
              <MapPin className="h-3 w-3 inline mr-1" />Location
            </span>
            <div className="flex gap-1">
              {LOCATION_PRESETS.map((p) => (
                <FilterChip
                  key={p.value}
                  active={(currentFilters.location || "") === p.value}
                  onClick={() => updateFilter("location", p.value || null)}
                  label={p.label}
                />
              ))}
            </div>
          </div>

          {/* Freshness filter */}
          <div className="shrink-0">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">
              <CalendarDays className="h-3 w-3 inline mr-1" />Posted
            </span>
            <div className="flex gap-1">
              {FRESHNESS_PRESETS.map((p) => (
                <FilterChip
                  key={p.value}
                  active={freshness === p.value}
                  onClick={() => setFreshness(p.value)}
                  label={p.label}
                />
              ))}
            </div>
          </div>

          {/* Email filter — 3-way */}
          <div className="shrink-0">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">
              <Mail className="h-3 w-3 inline mr-1" />Email
            </span>
            <div className="flex gap-1">
              <FilterChip
                active={!currentFilters.email || currentFilters.email === "all"}
                onClick={() => updateFilter("email", null)}
                label={`All (${emailCounts.all})`}
              />
              <FilterChip
                active={currentFilters.email === "verified"}
                onClick={() => updateFilter("email", "verified")}
                label={`Can Email (${emailCounts.verified})`}
              />
              <FilterChip
                active={currentFilters.email === "none"}
                onClick={() => updateFilter("email", "none")}
                label={`No Email (${emailCounts.none})`}
              />
            </div>
          </div>

          {/* Clear all */}
          {hasActiveFilters && (
            <div className="flex items-end shrink-0">
              <button
                onClick={resetAllFilters}
                className="rounded-md px-2 py-0.5 text-[11px] font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
              >
                <X className="h-3 w-3 inline mr-0.5" />Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {visibleJobs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 p-8 md:p-12 text-center">
          <Briefcase className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-200">No jobs match your filters</h3>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 mb-4">
            Try adjusting your search, lowering the score threshold, or changing location filter.
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Reset all filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600"
      }`}
    >
      {label}
    </button>
  );
}

const JobCard = memo(function JobCard({ job, onDismiss }: { job: RecommendedJob; onDismiss: (id: string) => Promise<void> | void }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!job.userJobId);
  const [dismissing, setDismissing] = useState(false);


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
    if (result.success) {
      setSaved(true);
      toast.success("Job saved to your board");
    } else {
      toast.error(result.error || "Failed to save job");
    }
  }, [saved, saving, job.id]);

  const handleDismiss = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dismissing) return;
    setDismissing(true);
    await onDismiss(job.id);
    setDismissing(false);
  }, [onDismiss, job.id, dismissing]);

  const handleViewExternal = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = job.applyUrl || job.sourceUrl;
    if (url) window.open(url, "_blank");
  }, [job.applyUrl, job.sourceUrl]);

  return (
    <div className="group block rounded-xl bg-white dark:bg-zinc-800 p-3 sm:p-4 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 transition-all duration-200 hover:shadow-md hover:ring-slate-200/80 dark:hover:ring-zinc-600/80">
      {/* Header: company + score */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500 min-w-0">
          <Building2 className="h-3 w-3 flex-shrink-0" />
          <span className="truncate font-medium">{job.company}</span>
        </div>
        <span className={`text-sm font-bold tabular-nums shrink-0 ${getScoreColor(score)}`} title="Match score">
          {Math.round(score)}%
        </span>
      </div>

      {/* Title */}
      <Link href={detailUrl}>
        <h3 className="text-[13px] font-bold text-slate-800 dark:text-zinc-100 leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-1.5 line-clamp-2 cursor-pointer">
          {job.title}
        </h3>
      </Link>

      {/* Badges — compact */}
      <div className="flex flex-wrap items-center gap-1 mb-1.5">
        <PlatformBadge source={job.source} />
        {status && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${status.cls}`}>
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
        <FreshnessDot lastSeenAt={job.lastSeenAt} firstSeenAt={job.firstSeenAt} />
        {job.companyEmail ? (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            (job.emailConfidence ?? 0) >= 80
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          }`}>
            <Mail className="h-2.5 w-2.5 inline mr-0.5" />
            {(job.emailConfidence ?? 0) >= 80 ? "Email" : "Email?"}
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400">
            No Email
          </span>
        )}
      </div>

      {/* Score bar */}
      <div className="mb-1.5">
        <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-zinc-700">
          <div
            className={`h-1 rounded-full transition-all duration-500 ${getScoreBg(score)}`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        {job.matchReasons.length > 0 && (
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 line-clamp-1">
            {job.matchReasons.slice(0, 2).join(" \u00B7 ")}
          </p>
        )}
      </div>

      {/* Salary */}
      {job.salary && (
        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mb-1.5 truncate">
          {job.salary}
        </div>
      )}

      {/* Skills — show fewer on mobile */}
      {job.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {job.skills.slice(0, 3).map((skill) => (
            <span key={skill} className="rounded bg-slate-100 dark:bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-zinc-300">
              {skill}
            </span>
          ))}
          {job.skills.length > 3 && (
            <span className="text-[10px] text-slate-400 dark:text-zinc-500">+{job.skills.length - 3}</span>
          )}
        </div>
      )}

      {/* Location */}
      {job.location && (
        <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-zinc-500 mb-2 truncate">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{job.location}</span>
        </div>
      )}

      {/* Actions — responsive: stack on very small, row on sm+ */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-50 dark:border-zinc-700/50 flex-wrap">
        {(job.applyUrl || job.sourceUrl) && (
          <button
            onClick={handleViewExternal}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation"
          >
            <ExternalLink className="h-3 w-3" /> Apply
          </button>
        )}

        {job.companyEmail && (job.emailConfidence ?? 0) >= 80 && (
          <Link
            href={`${detailUrl}?apply=true`}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 active:bg-emerald-300 transition-colors touch-manipulation"
          >
            <Mail className="h-3 w-3" /> Email
          </Link>
        )}

        <button
          onClick={handleSave}
          disabled={saved || saving}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors touch-manipulation ${
            saved
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 active:bg-blue-200"
          }`}
        >
          <Bookmark className="h-3 w-3" />
          {saved ? "Saved" : saving ? "..." : "Save"}
        </button>

        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-300 active:bg-red-200 transition-colors touch-manipulation ml-auto disabled:opacity-50"
        >
          <X className="h-3 w-3" /> {dismissing ? "..." : "Dismiss"}
        </button>
      </div>

      {/* DevRadar actions */}
      <div className="pt-1.5 mt-1.5 border-t border-dashed border-slate-100 dark:border-zinc-700/40">
        <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-medium mb-1">
          Prepare with DevRadar →
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const params = new URLSearchParams({
                jobTitle: job.title,
                company: job.company,
                source: 'jobpilot',
              });
              window.open(`https://dev-radar-web-j2jq.vercel.app/resume?${params}`, '_blank');
            }}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors touch-manipulation"
          >
            <BarChart2 className="h-3 w-3" />
            Analyze Gap
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const params = new URLSearchParams({
                jobTitle: job.title,
                company: job.company,
                source: 'jobpilot',
              });
              window.open(`https://dev-radar-web-j2jq.vercel.app/interview?${params}`, '_blank');
            }}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors touch-manipulation"
          >
            <MessageSquare className="h-3 w-3" />
            Prep Interview
          </button>
        </div>
      </div>
    </div>
  );
});
