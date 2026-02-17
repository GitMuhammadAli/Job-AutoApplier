"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useJobStore } from "@/store/useJobStore";
import { STAGES, STAGE_CONFIG } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Stage } from "@/types";

export function Header() {
  const { search, setSearch, filter, setFilter } = useJobStore();

  const filterOptions: Array<{ value: Stage | "ALL"; label: string }> = [
    { value: "ALL", label: "All" },
    ...STAGES.map((s) => ({ value: s as Stage, label: STAGE_CONFIG[s].label })),
  ];

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-slate-200/60 bg-white/70 px-6 backdrop-blur-xl">
      {/* Spacer for mobile menu button */}
      <div className="w-8 md:hidden" />

      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search companies, roles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-9 text-sm bg-slate-50/80 border-slate-200/60 rounded-lg focus:bg-white transition-colors"
        />
      </div>

      {/* Separator */}
      <div className="hidden md:block h-6 w-px bg-slate-200" />

      {/* Stage filter pills */}
      <div className="hidden md:flex items-center gap-1">
        <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 mr-1" />
        {filterOptions.map((opt) => {
          const isActive = filter === opt.value;
          const stageConfig = opt.value !== "ALL" ? STAGE_CONFIG[opt.value as Stage] : null;
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
    </header>
  );
}
