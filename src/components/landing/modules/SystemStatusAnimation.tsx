"use client";

import { useEffect, useState } from "react";

/**
 * System Status module — four background services with health pulses
 * and miniature sparklines. Occasionally one flickers amber to
 * demonstrate self-healing.
 */

type Health = "ok" | "warn" | "down";

interface Service {
  id: string;
  name: string;
  detail: string;
  sparkline: number[];
}

const SERVICES: Service[] = [
  { id: "scrapers", name: "Scrapers",    detail: "9/9 sources healthy",       sparkline: [4, 6, 5, 8, 7, 9, 10, 9, 11, 12, 11, 13] },
  { id: "ai",       name: "AI Router",   detail: "Groq → Gemini fallback",    sparkline: [8, 9, 9, 10, 9, 11, 12, 11, 12, 13, 12, 14] },
  { id: "smtp",     name: "SMTP",        detail: "0 bounces · 0 paused",      sparkline: [3, 4, 5, 4, 6, 7, 6, 8, 7, 9, 8, 10] },
  { id: "cron",     name: "Cron",        detail: "Next run in 12 minutes",    sparkline: [5, 7, 6, 8, 9, 8, 10, 11, 10, 12, 11, 13] },
];

export function SystemStatusAnimation({ active = true }: { active?: boolean }) {
  // health is computed live; one service flickers warn briefly every few cycles
  const [warnIdx, setWarnIdx] = useState<number | null>(null);
  const [uptime, setUptime] = useState(99.94);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const next = Math.random() < 0.4 ? Math.floor(Math.random() * SERVICES.length) : null;
      setWarnIdx(next);
    }, 2200);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setUptime((u) => {
        const drift = (Math.random() - 0.5) * 0.01;
        return Math.min(100, Math.max(99.8, +(u + drift).toFixed(2)));
      });
    }, 2800);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-br from-emerald-500/10 via-blue-400/8 to-transparent rounded-[2rem] blur-3xl pointer-events-none" />

      <div className="relative rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/70 dark:ring-zinc-800 shadow-2xl shadow-emerald-500/10 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 ml-2">
            JobPilot · System Status
          </span>
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Uptime</span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{uptime}%</span>
          </div>
        </div>

        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {SERVICES.map((s, i) => {
            const health: Health = warnIdx === i ? "warn" : "ok";
            const dot =
              health === "ok" ? "bg-emerald-500" : "bg-amber-500";
            const ring =
              health === "ok"
                ? "ring-emerald-200/40 dark:ring-emerald-800/30"
                : "ring-amber-300/60 dark:ring-amber-700/40";
            const label =
              health === "ok" ? "OK" : "Recovering";

            return (
              <li key={s.id} className={`flex items-center gap-4 px-4 py-3 ring-1 ring-inset ${ring} transition-colors`}>
                <div className="relative">
                  <span className={`block w-2.5 h-2.5 rounded-full ${dot}`} />
                  <span className={`absolute inset-0 rounded-full ${dot} animate-ping opacity-40`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">{s.name}</p>
                    <span className={`text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded ${
                      health === "ok"
                        ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
                        : "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30"
                    }`}>
                      {label}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-500 truncate">{s.detail}</p>
                </div>
                <Sparkline data={s.sparkline} warn={health === "warn"} />
              </li>
            );
          })}
        </ul>

        <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/40">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
            We monitor all four every minute. If something breaks, we tell you before you ask.
          </p>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data, warn }: { data: number[]; warn: boolean }) {
  const w = 56;
  const h = 18;
  const max = Math.max(...data);
  const stepX = w / (data.length - 1);
  const points = data.map((v, i) => `${(i * stepX).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-14 h-5 shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={warn ? "rgb(245 158 11)" : "rgb(16 185 129)"}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
