"use client";

import { useEffect, useState } from "react";

/**
 * Templates module — show a template on the left with placeholders,
 * and the same template on the right being filled with real values
 * for a specific job. Cycles through 3 jobs.
 */

const JOBS = [
  {
    name: "Maya",
    company: "Vercel",
    role: "Senior React Engineer",
    hook: "the new App Router work — I ship Next.js daily and would love to contribute.",
  },
  {
    name: "Jules",
    company: "Linear",
    role: "Full-Stack Engineer",
    hook: "your sync architecture — I've been studying conflict-free reads in pgvector.",
  },
  {
    name: "Sam",
    company: "Anthropic",
    role: "AI Platform Engineer",
    hook: "the multi-provider routing problem — I built a fallback router for Groq → Gemini.",
  },
];

const TEMPLATE_LINES = [
  "Subject: Re: {role} role",
  "",
  "Hi {name},",
  "",
  "Saw the {role} role at {company}. {hook}",
  "",
  "Github + a 60-sec demo: {portfolio}",
  "",
  "— Ali",
];

const PLACEHOLDERS = ["name", "company", "role", "hook"];

export function TemplatesAnimation({ active = true }: { active?: boolean }) {
  const [jobIdx, setJobIdx] = useState(0);
  const [filledCount, setFilledCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    setFilledCount(0);
    let n = 0;
    const stepId = setInterval(() => {
      n += 1;
      if (n > PLACEHOLDERS.length) {
        clearInterval(stepId);
        // pause, then next job
        setTimeout(() => {
          if (active) setJobIdx((j) => (j + 1) % JOBS.length);
        }, 1600);
        return;
      }
      setFilledCount(n);
    }, 600);
    return () => clearInterval(stepId);
  }, [jobIdx, active]);

  const job = JOBS[jobIdx];
  const filledSet = new Set(PLACEHOLDERS.slice(0, filledCount));

  function renderLine(line: string, withValues: boolean) {
    const parts = line.split(/(\{[a-z]+\})/g);
    return parts.map((part, i) => {
      const match = /^\{([a-z]+)\}$/.exec(part);
      if (!match) return <span key={i}>{part}</span>;
      const key = match[1];
      const value =
        key === "portfolio"
          ? "github.com/GitMuhammadAli"
          : (job as Record<string, string>)[key];

      if (withValues && (filledSet.has(key) || key === "portfolio")) {
        return (
          <span key={i} className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 rounded px-1 font-semibold">
            {value}
          </span>
        );
      }
      return (
        <span key={i} className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded px-1 font-mono text-[10px]">
          {`{${key}}`}
        </span>
      );
    });
  }

  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-br from-amber-500/10 via-emerald-400/10 to-transparent rounded-[2rem] blur-3xl pointer-events-none" />

      <div className="relative rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/70 dark:ring-zinc-800 shadow-2xl shadow-emerald-500/10 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 ml-2">
            JobPilot · Templates · 1 template, many jobs
          </span>
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[9px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Sending to</span>
            <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">{job.company}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-zinc-100 dark:divide-zinc-800">
          {/* Template (raw) */}
          <div className="p-4">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-2">
              Your template
            </p>
            <pre className="text-[10px] leading-[1.6] font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
              {TEMPLATE_LINES.map((line, i) => (
                <div key={i}>
                  {renderLine(line, false)}
                </div>
              ))}
            </pre>
          </div>

          {/* Filled */}
          <div className="p-4">
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Filling for {job.company}
            </p>
            <pre className="text-[10px] leading-[1.6] font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
              {TEMPLATE_LINES.map((line, i) => (
                <div key={i}>
                  {renderLine(line, true)}
                </div>
              ))}
            </pre>
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/40">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-500 flex items-center justify-between">
            <span>4-agent pipeline fills <code className="text-[9px] text-emerald-600 dark:text-emerald-400">{"{hook}"}</code> with a researched line per company.</span>
            <span className="tabular-nums">{filledCount}/{PLACEHOLDERS.length} filled</span>
          </p>
        </div>
      </div>
    </div>
  );
}
