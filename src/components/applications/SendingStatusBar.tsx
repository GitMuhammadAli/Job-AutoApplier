"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { Send, AlertTriangle, Clock, PauseCircle } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SendingStatusBarProps {
  sentToday?: number;
  maxPerDay?: number;
  sentThisHour?: number;
  maxPerHour?: number;
  isPaused?: boolean;
}

export function SendingStatusBar(props: SendingStatusBarProps) {
  const { data: stats } = useSWR("/api/applications/send-stats", fetcher, {
    refreshInterval: 10000,
    fallbackData: props.sentToday != null
      ? {
          todayCount: props.sentToday,
          hourCount: props.sentThisHour ?? 0,
          maxPerDay: props.maxPerDay ?? 20,
          maxPerHour: props.maxPerHour ?? 8,
          nextSendInSeconds: 0,
          isPaused: props.isPaused ?? false,
          pausedUntil: null,
        }
      : null,
  });

  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (stats?.nextSendInSeconds > 0) {
      setCountdown(stats.nextSendInSeconds);
      const interval = setInterval(() => {
        setCountdown((c: number) => Math.max(0, c - 1));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCountdown(0);
    }
  }, [stats?.nextSendInSeconds]);

  if (!stats) return null;

  const todayCount = stats.todayCount ?? stats.sentToday ?? 0;
  const hourCount = stats.hourCount ?? stats.sentThisHour ?? 0;
  const maxPerDay = stats.maxPerDay ?? 20;
  const maxPerHour = stats.maxPerHour ?? 8;
  const isPaused = stats.isPaused ?? false;

  const dayPercent = Math.round((todayCount / maxPerDay) * 100);
  const isWarning = dayPercent >= 80;

  if (isPaused) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 px-4 py-2.5 ring-1 ring-red-200/60 dark:ring-red-800/40">
        <PauseCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <span className="text-xs font-semibold text-red-700 dark:text-red-300">
          Sending paused — bounces detected.
          {stats.pausedUntil && (
            <> Resumes at {new Date(stats.pausedUntil).toLocaleTimeString()}.</>
          )}{" "}
          You can still use &quot;Copy All&quot; to apply manually.
        </span>
      </div>
    );
  }

  const hourPercent = Math.round((hourCount / maxPerHour) * 100);
  const hourWarning = hourPercent >= 80;

  return (
    <div
      className={`rounded-xl px-4 py-3 ring-1 space-y-3 ${
        isWarning
          ? "bg-amber-50 dark:bg-amber-950/30 ring-amber-200/60 dark:ring-amber-800/40"
          : "bg-slate-50 dark:bg-zinc-800/60 ring-slate-200/60 dark:ring-zinc-700/60"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Send className="h-3 w-3" />
            Today:{" "}
            <strong className="text-slate-700 dark:text-zinc-200 tabular-nums">
              {todayCount}/{maxPerDay}
            </strong>{" "}
            sent
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            This hour:{" "}
            <strong className="text-slate-700 dark:text-zinc-200 tabular-nums">
              {hourCount}/{maxPerHour}
            </strong>
          </span>
          {countdown > 0 && (
            <span className="text-slate-400 dark:text-zinc-500">
              Next send in: {formatTime(countdown)}
            </span>
          )}
        </div>
        {isWarning && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Approaching daily limit
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500 dark:text-zinc-400 font-medium">Daily</span>
            <span className="text-slate-400 dark:text-zinc-500 tabular-nums">{dayPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isWarning
                  ? "bg-gradient-to-r from-amber-400 to-amber-500"
                  : "bg-gradient-to-r from-blue-400 to-blue-600"
              }`}
              style={{ width: `${Math.min(dayPercent, 100)}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500 dark:text-zinc-400 font-medium">Hourly</span>
            <span className="text-slate-400 dark:text-zinc-500 tabular-nums">{hourPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                hourWarning
                  ? "bg-gradient-to-r from-amber-400 to-amber-500"
                  : "bg-gradient-to-r from-violet-400 to-violet-600"
              }`}
              style={{ width: `${Math.min(hourPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
