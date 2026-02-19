"use client";

import { useState, useEffect } from "react";
import { Search, SlidersHorizontal, ChevronDown, PanelLeftOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useJobStore } from "@/store/useJobStore";
import { useSidebarStore } from "@/store/useSidebarStore";
import { STAGES, STAGE_CONFIG } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { JobStage } from "@prisma/client";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { PauseToggle } from "@/components/shared/PauseToggle";

export function Header() {
  const { search, setSearch, filter, setFilter } = useJobStore();
  const { collapsed, toggle } = useSidebarStore();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/mode")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.status) setAccountStatus(data.status);
      })
      .catch(() => {});
  }, []);

  const filterOptions: Array<{ value: JobStage | "ALL"; label: string }> = [
    { value: "ALL", label: "All" },
    ...STAGES.map((s) => ({ value: s as JobStage, label: STAGE_CONFIG[s].label })),
  ];

  const activeLabel = filterOptions.find((o) => o.value === filter)?.label || "All";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl">
      <div className="flex h-12 md:h-14 items-center gap-3 px-4 md:px-6">
        {/* Spacer for mobile hamburger */}
        <div className="w-8 md:hidden" />

        {/* Desktop sidebar open button — visible only when sidebar is collapsed */}
        {collapsed && (
          <button
            onClick={toggle}
            aria-label="Open sidebar"
            className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
          >
            <PanelLeftOpen className="h-4.5 w-4.5" />
          </button>
        )}

        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <label htmlFor="search-jobs" className="sr-only">Search jobs</label>
          <Input
            id="search-jobs"
            placeholder="Search companies, roles&hellip;"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            className="h-8 md:h-9 pl-9 text-sm bg-slate-50/80 dark:bg-zinc-800/80 border-slate-200/60 dark:border-zinc-700/60 rounded-lg focus:bg-white dark:focus:bg-zinc-800 transition-colors"
          />
        </div>

        <button
          onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
          aria-label="Toggle filters"
          aria-expanded={mobileFilterOpen}
          className="md:hidden flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-300 touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
          <SlidersHorizontal className="h-3 w-3" />
          {activeLabel}
          <ChevronDown className={cn("h-3 w-3 transition-transform", mobileFilterOpen && "rotate-180")} />
        </button>

        <div className="hidden md:block h-6 w-px bg-slate-200 dark:bg-zinc-700" />

        <div className="hidden md:flex items-center gap-1">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 mr-1" />
          {filterOptions.map((opt) => {
            const isActive = filter === opt.value;
            const stageConfig = opt.value !== "ALL" ? STAGE_CONFIG[opt.value as JobStage] : null;
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 touch-manipulation",
                  isActive
                    ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
                    : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-200"
                )}
              >
                {stageConfig && (
                  <span className={cn("inline-block h-1.5 w-1.5 rounded-full mr-1", stageConfig.dot)} />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {accountStatus && (
            <div className="hidden sm:block">
              <PauseToggle initialStatus={accountStatus} />
            </div>
          )}
          <ThemeToggle />
        </div>
      </div>

      {mobileFilterOpen && (
        <div className="md:hidden border-t border-slate-100 dark:border-zinc-700 px-4 py-2 flex flex-wrap gap-1.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm">
          {filterOptions.map((opt) => {
            const isActive = filter === opt.value;
            const stageConfig = opt.value !== "ALL" ? STAGE_CONFIG[opt.value as JobStage] : null;
            return (
              <button
                key={opt.value}
                onClick={() => { setFilter(opt.value); setMobileFilterOpen(false); }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors touch-manipulation",
                  isActive
                    ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
                    : "bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700"
                )}
              >
                {stageConfig && (
                  <span className={cn("inline-block h-1.5 w-1.5 rounded-full mr-1.5", stageConfig.dot)} />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
