"use client";

import { useEffect, useState } from "react";

/**
 * Find Jobs module — discovery pipeline.
 * Shows: 9 sources pulsing, jobs streaming in, match scores computed,
 * filter pass leaving only high-match jobs.
 */

const SOURCES = [
  { name: "LinkedIn", color: "blue" },
  { name: "Indeed", color: "indigo" },
  { name: "Remote OK", color: "emerald" },
  { name: "Y Combinator", color: "orange" },
  { name: "Wellfound", color: "violet" },
  { name: "WeWorkRemotely", color: "cyan" },
  { name: "Glassdoor", color: "emerald" },
  { name: "ZipRecruiter", color: "amber" },
  { name: "Hacker News", color: "orange" },
] as const;

const INCOMING_JOBS = [
  { title: "Senior React Engineer", company: "Vercel", score: 95 },
  { title: "AI Platform Engineer", company: "Anthropic", score: 91 },
  { title: "Full-Stack Engineer", company: "Linear", score: 88 },
  { title: "Frontend Developer", company: "Supabase", score: 76 },
  { title: "WordPress Theme Dev", company: "RetroAgency", score: 42 },
  { title: "PHP Backend", company: "LegacyCo", score: 31 },
] as const;

export function FindJobsAnimation({ active = true }: { active?: boolean }) {
  const [activeSource, setActiveSource] = useState(0);
  const [streamCount, setStreamCount] = useState(0);
  const [filtered, setFiltered] = useState(false);
  const [indexCount, setIndexCount] = useState(12847);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setActiveSource((s) => (s + 1) % SOURCES.length), 700);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let n = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const id = setInterval(() => {
      n += 1;
      setStreamCount(Math.min(n, INCOMING_JOBS.length));
      if (n === INCOMING_JOBS.length) {
        timeouts.push(setTimeout(() => setFiltered(true), 1200));
        timeouts.push(
          setTimeout(() => {
            setFiltered(false);
            setStreamCount(0);
            n = 0;
          }, 4500),
        );
      }
    }, 700);
    return () => {
      clearInterval(id);
      timeouts.forEach(clearTimeout);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setIndexCount((n) => n + Math.floor(Math.random() * 5) + 1), 1800);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-br from-blue-500/10 via-emerald-400/10 to-transparent rounded-[2rem] blur-3xl pointer-events-none" />

      <div className="relative rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/70 dark:ring-zinc-800 shadow-2xl shadow-emerald-500/10 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 ml-2">
            JobPilot · Find Jobs
          </span>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-emerald-500 font-semibold uppercase tracking-wider">Scraping</span>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1.2fr] divide-x divide-zinc-100 dark:divide-zinc-800 min-h-[400px]">
          {/* Source grid */}
          <div className="p-4">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-2">
              9 sources · live
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {SOURCES.map((s, i) => (
                <div
                  key={s.name}
                  className={`rounded-md px-2 py-2 text-[9px] font-medium truncate transition-all duration-300 ring-1 ${
                    activeSource === i
                      ? "bg-emerald-500/15 ring-emerald-400 dark:ring-emerald-500/50 text-emerald-700 dark:text-emerald-300 scale-105"
                      : "bg-zinc-50 dark:bg-zinc-800/60 ring-zinc-200 dark:ring-zinc-700/40 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {activeSource === i && (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                      </span>
                    )}
                    <span className="truncate">{s.name}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 ring-1 ring-zinc-200/60 dark:ring-zinc-700/40">
                <p className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600">Indexed today</p>
                <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-white">
                  {indexCount.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40">
                <p className="text-[9px] uppercase tracking-wider text-emerald-700/70 dark:text-emerald-300/70">Cron cadence</p>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Every 60 minutes</p>
              </div>
            </div>
          </div>

          {/* Job stream */}
          <div className="p-4">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-2">
              {filtered ? "Filtered · 3 above 70% threshold" : "Incoming · scored against your resume"}
            </p>

            <div className="space-y-1.5">
              {INCOMING_JOBS.map((job, i) => {
                const visible = i < streamCount;
                const passes = job.score >= 70;
                const hidden = filtered && !passes;
                return (
                  <div
                    key={job.title}
                    className={`rounded-lg ring-1 px-2.5 py-1.5 transition-all duration-500 ${
                      hidden
                        ? "opacity-0 -translate-x-4"
                        : visible
                        ? passes
                          ? "bg-emerald-50/80 dark:bg-emerald-950/30 ring-emerald-200 dark:ring-emerald-800/40 opacity-100 translate-x-0"
                          : "bg-zinc-50 dark:bg-zinc-800/60 ring-zinc-200 dark:ring-zinc-700/40 opacity-70 translate-x-0"
                        : "opacity-0 translate-x-4"
                    }`}
                    style={{ transitionDelay: visible ? `${i * 60}ms` : "0ms" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-[10px] font-semibold truncate ${passes ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-500 dark:text-zinc-500"}`}>
                          {job.title}
                        </p>
                        <p className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate">{job.company}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-10 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                          <div
                            className={passes ? "h-full bg-emerald-500" : "h-full bg-zinc-400 dark:bg-zinc-600"}
                            style={{
                              width: visible ? `${job.score}%` : "0%",
                              transition: "width 600ms ease-out",
                            }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold tabular-nums ${passes ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-600"}`}>
                          {job.score}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
