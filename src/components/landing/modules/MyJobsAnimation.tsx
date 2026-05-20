"use client";

import { useEffect, useState } from "react";

/**
 * My Jobs module — Kanban pipeline.
 * Cards live-progress through stages: Saved → Applied → Interview → Offer.
 */

type Stage = "saved" | "applied" | "interview" | "offer";

interface CardData {
  id: string;
  title: string;
  company: string;
  score: number;
  stage: Stage;
}

const INITIAL: CardData[] = [
  { id: "j1", title: "Senior React Dev", company: "Vercel", score: 95, stage: "saved" },
  { id: "j2", title: "AI Platform Eng", company: "Anthropic", score: 91, stage: "saved" },
  { id: "j3", title: "Full-Stack Eng", company: "Linear", score: 88, stage: "applied" },
  { id: "j4", title: "Frontend Eng", company: "Supabase", score: 82, stage: "applied" },
  { id: "j5", title: "React Native", company: "Expo", score: 86, stage: "interview" },
  { id: "j6", title: "TS Developer", company: "Stripe", score: 89, stage: "offer" },
];

const STAGES: { id: Stage; label: string; dot: string; count: number }[] = [
  { id: "saved", label: "Saved", dot: "bg-blue-500", count: 0 },
  { id: "applied", label: "Applied", dot: "bg-amber-500", count: 0 },
  { id: "interview", label: "Interview", dot: "bg-emerald-500", count: 0 },
  { id: "offer", label: "Offer", dot: "bg-violet-500", count: 0 },
];

const NEXT: Record<Stage, Stage | null> = {
  saved: "applied",
  applied: "interview",
  interview: "offer",
  offer: null,
};

export function MyJobsAnimation({ active = true }: { active?: boolean }) {
  const [cards, setCards] = useState<CardData[]>(INITIAL);
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const id = setInterval(() => {
      setCards((prev) => {
        const candidates = prev.filter((c) => NEXT[c.stage]);
        if (!candidates.length) {
          return INITIAL;
        }
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        setMovingId(target.id);
        timeouts.push(setTimeout(() => setMovingId(null), 600));
        return prev.map((c) =>
          c.id === target.id ? { ...c, stage: NEXT[c.stage]! } : c,
        );
      });
    }, 2400);
    return () => {
      clearInterval(id);
      timeouts.forEach(clearTimeout);
    };
  }, [active]);

  const stageCounts = STAGES.map((s) => ({
    ...s,
    count: cards.filter((c) => c.stage === s.id).length,
  }));

  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-br from-violet-500/10 via-emerald-400/10 to-transparent rounded-[2rem] blur-3xl pointer-events-none" />

      <div className="relative rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/70 dark:ring-zinc-800 shadow-2xl shadow-emerald-500/10 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 ml-2">
            JobPilot · My Jobs · Kanban
          </span>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-emerald-500 font-semibold uppercase tracking-wider">Live</span>
          </div>
        </div>

        <div className="p-4 grid grid-cols-4 gap-2 min-h-[380px]">
          {stageCounts.map((stage) => (
            <div key={stage.id} className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 mb-2.5">
                <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
                <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 truncate">{stage.label}</span>
                <span className="ml-auto text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded px-1 min-w-[14px] text-center">
                  {stage.count}
                </span>
              </div>
              <div className="space-y-1.5 flex-1">
                {cards
                  .filter((c) => c.stage === stage.id)
                  .map((c) => (
                    <div
                      key={c.id}
                      className={`rounded-lg p-2 ring-1 transition-all duration-500 ${
                        movingId === c.id
                          ? "bg-emerald-100 dark:bg-emerald-900/40 ring-emerald-400 dark:ring-emerald-500 scale-[1.03] shadow-md shadow-emerald-500/20"
                          : "bg-zinc-50 dark:bg-zinc-800/80 ring-zinc-100 dark:ring-zinc-700/50"
                      }`}
                    >
                      <p className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">{c.title}</p>
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate">{c.company}</p>
                      <div className="mt-1 flex items-center gap-1">
                        <div className="flex-1 h-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${c.score}%` }} />
                        </div>
                        <span className="text-[8px] font-bold tabular-nums text-zinc-500 dark:text-zinc-400">{c.score}%</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/40">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-500 flex items-center justify-between">
            <span>Drag, click, or auto-advance — every state syncs.</span>
            <span className="tabular-nums">{cards.length} active</span>
          </p>
        </div>
      </div>
    </div>
  );
}
