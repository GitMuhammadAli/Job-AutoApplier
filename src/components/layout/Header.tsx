"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useJobStore } from "@/store/useJobStore";
import { STAGES, STAGE_CONFIG } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Stage } from "@/types";

export function Header() {
  const { search, setSearch, filter, setFilter } = useJobStore();

  const filterOptions: Array<{ value: Stage | "ALL"; label: string }> = [
    { value: "ALL", label: "All Stages" },
    ...STAGES.map((s) => ({ value: s as Stage, label: STAGE_CONFIG[s].label })),
  ];

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-white/80 px-6 backdrop-blur-sm">
      {/* Spacer for mobile menu button */}
      <div className="w-8 md:hidden" />

      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-slate-50 border-slate-200"
        />
      </div>

      {/* Stage filter pills */}
      <div className="hidden md:flex items-center gap-1.5">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === opt.value
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </header>
  );
}
