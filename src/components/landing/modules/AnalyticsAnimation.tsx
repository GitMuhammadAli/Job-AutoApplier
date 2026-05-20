"use client";

import { useEffect, useState } from "react";

/**
 * Analytics module — three live charts:
 *   1. Sparkline of applications per day (animated draw)
 *   2. Donut of response rate
 *   3. Funnel: Sent → Opened → Replied → Interview
 */

const DAILY = [3, 5, 4, 8, 12, 9, 11, 14, 18, 22, 19, 24, 28];
const RESPONSE_RATE = 18; // percent
const FUNNEL = [
  { stage: "Sent",       count: 100, color: "bg-zinc-400 dark:bg-zinc-600" },
  { stage: "Opened",     count: 64,  color: "bg-blue-500" },
  { stage: "Replied",    count: 18,  color: "bg-emerald-500" },
  { stage: "Interview",  count: 7,   color: "bg-violet-500" },
];

const TOTAL = DAILY.reduce((a, b) => a + b, 0);

export function AnalyticsAnimation({ active = true }: { active?: boolean }) {
  const [drawn, setDrawn] = useState(false);
  const [pulseChart, setPulseChart] = useState<"spark" | "donut" | "funnel">("spark");

  useEffect(() => {
    if (!active) {
      setDrawn(false);
      return;
    }
    // animate-in once when activated
    const t = setTimeout(() => setDrawn(true), 80);
    return () => clearTimeout(t);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(
      () => setPulseChart((p) => (p === "spark" ? "donut" : p === "donut" ? "funnel" : "spark")),
      2200,
    );
    return () => clearInterval(id);
  }, [active]);

  // sparkline path
  const max = Math.max(...DAILY);
  const w = 280;
  const h = 64;
  const stepX = w / (DAILY.length - 1);
  const points = DAILY.map((v, i) => [i * stepX, h - (v / max) * h]);
  const path =
    "M " +
    points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ");

  // donut
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dash = drawn ? (circumference * RESPONSE_RATE) / 100 : 0;

  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-br from-blue-500/10 via-emerald-400/10 to-violet-500/10 rounded-[2rem] blur-3xl pointer-events-none" />

      <div className="relative rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/70 dark:ring-zinc-800 shadow-2xl shadow-emerald-500/10 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 ml-2">
            JobPilot · Analytics · last 13 days
          </span>
        </div>

        {/* Sparkline */}
        <div className={`px-4 pt-3 pb-3 border-b border-zinc-100 dark:border-zinc-800 transition-all duration-500 ${pulseChart === "spark" ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}>
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600">Applications · daily</p>
              <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-white">{TOTAL}</p>
            </div>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">↑ +24% vs last week</p>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12">
            <defs>
              <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`${path} L ${w},${h} L 0,${h} Z`}
              fill="url(#spark-fill)"
              style={{ opacity: drawn ? 1 : 0, transition: "opacity 700ms ease-out" }}
            />
            <path
              d={path}
              fill="none"
              stroke="rgb(16 185 129)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 600,
                strokeDashoffset: drawn ? 0 : 600,
                transition: "stroke-dashoffset 1200ms ease-out",
              }}
            />
            {points.map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="2"
                fill="rgb(16 185 129)"
                style={{
                  opacity: drawn ? 1 : 0,
                  transition: `opacity 350ms ${800 + i * 30}ms ease-out`,
                }}
              />
            ))}
          </svg>
        </div>

        {/* Donut + funnel side-by-side */}
        <div className="grid grid-cols-[120px_1fr]">
          <div className={`p-4 flex flex-col items-center justify-center border-r border-zinc-100 dark:border-zinc-800 transition-all duration-500 ${pulseChart === "donut" ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}>
            <p className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-2">Response rate</p>
            <div className="relative w-20 h-20">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-zinc-200 dark:text-zinc-800" />
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  fill="none"
                  stroke="rgb(16 185 129)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: circumference - dash,
                    transition: "stroke-dashoffset 1500ms ease-out 300ms",
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-bold tabular-nums text-zinc-900 dark:text-white">{RESPONSE_RATE}%</span>
              </div>
            </div>
          </div>

          <div className={`p-4 transition-all duration-500 ${pulseChart === "funnel" ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}>
            <p className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-2">Funnel · this month</p>
            <div className="space-y-1.5">
              {FUNNEL.map((row, i) => (
                <div key={row.stage} className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 w-16">{row.stage}</span>
                  <div className="flex-1 h-3.5 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full ${row.color}`}
                      style={{
                        width: drawn ? `${row.count}%` : "0%",
                        transition: `width 900ms ${i * 120 + 200}ms ease-out`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums text-zinc-700 dark:text-zinc-300 w-6 text-right">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/40">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
            Know what's working before you spend another month.
          </p>
        </div>
      </div>
    </div>
  );
}
