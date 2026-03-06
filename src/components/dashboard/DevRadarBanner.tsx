"use client";

import { useState, useEffect } from "react";
import { Radar, X } from "lucide-react";

export function DevRadarBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem("devradar-banner-dismissed") === "1");
  }, []);

  if (dismissed) return null;

  return (
    <div className="relative rounded-xl border border-purple-500/20
                    bg-gradient-to-r from-purple-950/40 to-purple-900/20
                    p-4 flex items-center gap-4 mb-6">
      <button
        onClick={() => {
          setDismissed(true);
          localStorage.setItem("devradar-banner-dismissed", "1");
        }}
        className="absolute top-2 right-2 text-slate-400 dark:text-zinc-500
                   hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="w-10 h-10 rounded-lg bg-purple-500/20
                      flex items-center justify-center flex-shrink-0">
        <Radar className="w-5 h-5 text-purple-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
          Know your market before you apply
        </div>
        <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          DevRadar shows skill trends, salary data & preps you for interviews
        </div>
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <a
          href="https://dev-radar-web-j2jq.vercel.app/resume"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs font-medium rounded-lg
                     bg-purple-500/20 text-purple-300
                     hover:bg-purple-500/30 transition-colors"
        >
          Check my gaps
        </a>
        <a
          href="https://dev-radar-web-j2jq.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs font-medium rounded-lg
                     bg-purple-500 text-white
                     hover:bg-purple-600 transition-colors"
        >
          Open DevRadar →
        </a>
      </div>
    </div>
  );
}
