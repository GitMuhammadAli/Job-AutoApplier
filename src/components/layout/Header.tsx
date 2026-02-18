"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useJobStore } from "@/store/useJobStore";
import { STAGES, STAGE_CONFIG } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { JobStage } from "@prisma/client";

export function Header() {
  const { search, setSearch, filter, setFilter } = useJobStore();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const filterOptions: Array<{ value: JobStage | "ALL"; label: string }> = [
    { value: "ALL", label: "All" },
    ...STAGES.map((s) => ({ value: s as JobStage, label: STAGE_CONFIG[s].label })),
  ];

  const activeLabel = filterOptions.find((o) => o.value === filter)?.label || "All";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
      <div className="flex h-12 md:h-14 items-center gap-3 px-4 md:px-6">
        <div className="w-8 md:hidden" />

        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search companies, roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 md:h-9 pl-9 text-sm bg-slate-50/80 border-slate-200/60 rounded-lg focus:bg-white transition-colors"
          />
        </div>

        <button
          onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
          className="md:hidden flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600"
        >
          <SlidersHorizontal className="h-3 w-3" />
          {activeLabel}
          <ChevronDown className={cn("h-3 w-3 transition-transform", mobileFilterOpen && "rotate-180")} />
        </button>

        <div className="hidden md:block h-6 w-px bg-slate-200" />

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
                  "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all duration-200",
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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
      </div>

      {mobileFilterOpen && (
        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex flex-wrap gap-1.5 bg-white/90 backdrop-blur-sm">
          {filterOptions.map((opt) => {
            const isActive = filter === opt.value;
            const stageConfig = opt.value !== "ALL" ? STAGE_CONFIG[opt.value as JobStage] : null;
            return (
              <button
                key={opt.value}
                onClick={() => { setFilter(opt.value); setMobileFilterOpen(false); }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
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
