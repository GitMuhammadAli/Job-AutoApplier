"use client";

import { useEffect, useState } from "react";

const SCENE_DURATION_MS = 2800;
const SCENE_COUNT = 4;

const SOURCES = [
  "LinkedIn", "Indeed", "Remote OK", "Y Combinator",
  "Wellfound", "WeWorkRemotely", "Glassdoor", "ZipRecruiter", "Hacker News",
];

const MATCHED = [
  { title: "Senior React Engineer", company: "Vercel", score: 95, color: "emerald" as const },
  { title: "Full-Stack Engineer", company: "Linear", score: 88, color: "emerald" as const },
  { title: "Node.js Backend", company: "Stripe", score: 82, color: "emerald" as const },
];

const EMAIL_LINES = [
  "Subject: Re: Senior React Engineer @ Vercel",
  "",
  "Hi Maya,",
  "",
  "Saw the Senior React role on your careers page. I've shipped",
  "DevRadar (Next.js + tRPC + pgvector) and JobPilot — happy to",
  "send you the GitHub if useful.",
  "",
  "— Ali",
];

function useScene() {
  const [scene, setScene] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setScene((s) => (s + 1) % SCENE_COUNT), SCENE_DURATION_MS);
    return () => clearInterval(id);
  }, []);
  return scene;
}

function useTypewriter(lines: string[], active: boolean) {
  const [charCount, setCharCount] = useState(0);
  const fullText = lines.join("\n");

  useEffect(() => {
    if (!active) {
      setCharCount(0);
      return;
    }
    let idx = 0;
    const id = setInterval(() => {
      idx += 2;
      setCharCount(idx);
      if (idx >= fullText.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [active, fullText]);

  return fullText.slice(0, charCount);
}

function StepBadge({ active, label, idx }: { active: boolean; label: string; idx: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-500 ${
          active
            ? "bg-emerald-500 text-white scale-110 shadow-lg shadow-emerald-500/40"
            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
        }`}
      >
        {idx}
      </div>
      <span className={`text-xs font-semibold transition-colors duration-500 ${
        active ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-600"
      }`}>
        {label}
      </span>
    </div>
  );
}

function SceneShell({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`absolute inset-0 p-5 transition-all duration-700 ${
        active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}

function ScanScene({ active }: { active: boolean }) {
  return (
    <SceneShell active={active}>
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Scanning sources
          </span>
        </div>
        <p className="text-base font-bold text-zinc-900 dark:text-white mb-4">
          Pulling fresh roles from 9 sites
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {SOURCES.map((s, i) => (
            <div
              key={s}
              className={`rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-[10px] font-medium text-zinc-700 dark:text-zinc-300 truncate transition-opacity ${active ? "" : "opacity-0"}`}
              style={{ animation: active ? `landing-fade-up 400ms ${i * 60}ms both` : undefined }}
            >
              {s}
            </div>
          ))}
        </div>
        <div className="mt-auto pt-3 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Last sync · 2s ago</span>
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            12,847 indexed
          </span>
        </div>
      </div>
    </SceneShell>
  );
}

function MatchScene({ active }: { active: boolean }) {
  return (
    <SceneShell active={active}>
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Match scoring
          </span>
        </div>
        <p className="text-base font-bold text-zinc-900 dark:text-white mb-3">
          Ranking jobs against your resume
        </p>
        <div className="space-y-2">
          {MATCHED.map((m, i) => (
            <div
              key={m.title}
              className="rounded-lg bg-zinc-50 dark:bg-zinc-800/80 p-2.5 ring-1 ring-zinc-100 dark:ring-zinc-700/50"
              style={{ animation: active ? `landing-fade-up 450ms ${i * 120}ms both` : undefined }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">{m.title}</p>
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500">{m.company}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-12 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: active ? `${m.score}%` : "0%", transition: `width 800ms ${i * 120 + 200}ms ease-out` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {m.score}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-3 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">3 above 80% threshold</span>
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            Filtered · ready to draft
          </span>
        </div>
      </div>
    </SceneShell>
  );
}

function DraftScene({ active }: { active: boolean }) {
  const text = useTypewriter(EMAIL_LINES, active);
  return (
    <SceneShell active={active}>
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            AI drafting
          </span>
        </div>
        <p className="text-base font-bold text-zinc-900 dark:text-white mb-3">
          Email written in your voice
        </p>
        <pre className="text-[10px] leading-[1.5] font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/80 rounded-lg p-2.5 ring-1 ring-zinc-100 dark:ring-zinc-700/50 whitespace-pre-wrap break-words overflow-hidden flex-1">
{text}
          <span className="inline-block w-[2px] h-3 bg-emerald-500 ml-0.5 align-middle animate-pulse" />
        </pre>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">4-agent pipeline · QA-checked</span>
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Ready to send</span>
        </div>
      </div>
    </SceneShell>
  );
}

function SentScene({ active }: { active: boolean }) {
  return (
    <SceneShell active={active}>
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div
          className="relative h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center mb-4 shadow-xl shadow-emerald-500/40"
          style={{ animation: active ? "landing-pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both" : undefined }}
        >
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
          <svg className="relative h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-base font-bold text-zinc-900 dark:text-white">Sent from your Gmail</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Logged to Kanban · activity tracked
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            12:47 PM · alishahid.dev@gmail.com
          </span>
        </div>
      </div>
    </SceneShell>
  );
}

export function PipelineDemo() {
  const scene = useScene();

  return (
    <div className="relative">
      {/* Soft emerald glow behind the device */}
      <div className="absolute -inset-6 bg-gradient-to-tr from-emerald-500/15 via-emerald-400/5 to-transparent rounded-[2rem] blur-2xl pointer-events-none" />

      {/* Device frame */}
      <div className="relative rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl shadow-emerald-500/10 ring-1 ring-zinc-200/70 dark:ring-zinc-800 overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 ml-2">
            JobPilot · live pipeline
          </span>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-emerald-500 font-semibold uppercase tracking-wider">Live</span>
          </div>
        </div>

        {/* Step indicators */}
        <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
          <StepBadge active={scene === 0} label="Scan" idx={1} />
          <StepBadge active={scene === 1} label="Match" idx={2} />
          <StepBadge active={scene === 2} label="Draft" idx={3} />
          <StepBadge active={scene === 3} label="Send" idx={4} />
        </div>

        {/* Scene canvas */}
        <div className="relative h-[280px] bg-white dark:bg-zinc-900">
          <ScanScene active={scene === 0} />
          <MatchScene active={scene === 1} />
          <DraftScene active={scene === 2} />
          <SentScene active={scene === 3} />
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div
            key={scene}
            className="h-full bg-emerald-500"
            style={{ animation: `landing-progress ${SCENE_DURATION_MS}ms linear` }}
          />
        </div>
      </div>
    </div>
  );
}
