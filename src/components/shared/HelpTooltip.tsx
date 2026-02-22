"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

interface HelpTooltipProps {
  text: string;
}

export function HelpTooltip({ text }: HelpTooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-flex items-center ml-1">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
        aria-label="Help"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 rounded-lg bg-slate-800 dark:bg-zinc-700 px-3 py-2 text-[11px] leading-relaxed text-white dark:text-zinc-100 shadow-lg pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800 dark:border-t-zinc-700" />
        </span>
      )}
    </span>
  );
}
