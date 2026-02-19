"use client";

import { Send, AlertTriangle, Clock, PauseCircle } from "lucide-react";

interface SendingStatusBarProps {
  sentToday: number;
  maxPerDay: number;
  sentThisHour: number;
  maxPerHour: number;
  isPaused: boolean;
}

export function SendingStatusBar({
  sentToday,
  maxPerDay,
  sentThisHour,
  maxPerHour,
  isPaused,
}: SendingStatusBarProps) {
  const dailyPercent = Math.min((sentToday / maxPerDay) * 100, 100);
  const nearLimit = dailyPercent >= 80;

  if (isPaused) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-red-50 px-4 py-2.5 ring-1 ring-red-200/60">
        <PauseCircle className="h-4 w-4 text-red-600" />
        <span className="text-xs font-semibold text-red-700">
          Sending paused due to bounces. Check Settings to resume.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2.5 ring-1 ring-slate-200/60">
      <div className="flex items-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <Send className="h-3 w-3" />
          Today: <strong className="text-slate-700 tabular-nums">{sentToday}/{maxPerDay}</strong> sent
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          This hour: <strong className="text-slate-700 tabular-nums">{sentThisHour}/{maxPerHour}</strong>
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {nearLimit && (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        )}
        <div className="h-1.5 w-24 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              nearLimit ? "bg-amber-500" : "bg-blue-500"
            }`}
            style={{ width: `${dailyPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
