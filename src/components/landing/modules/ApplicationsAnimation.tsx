"use client";

import { useEffect, useState } from "react";

/**
 * Applications module — email send pipeline.
 * Each row cycles through Draft → Sending → Delivered → Opened states
 * at different phases so the list always feels alive.
 */

type Status = "draft" | "sending" | "delivered" | "opened" | "replied";

interface Row {
  id: string;
  company: string;
  role: string;
  phase: number; // 0..N — animation phase offset
}

const ROWS: Row[] = [
  { id: "a1", company: "Vercel",     role: "Senior React Engineer", phase: 0 },
  { id: "a2", company: "Linear",     role: "Full-Stack Engineer",   phase: 1 },
  { id: "a3", company: "Anthropic",  role: "AI Platform Engineer",  phase: 2 },
  { id: "a4", company: "Stripe",     role: "TypeScript Developer",  phase: 3 },
  { id: "a5", company: "Supabase",   role: "Frontend Engineer",     phase: 4 },
];

const STATUS_SEQUENCE: Status[] = ["draft", "sending", "delivered", "opened", "replied"];

function statusOf(row: Row, tick: number): Status {
  const idx = (tick + row.phase) % STATUS_SEQUENCE.length;
  return STATUS_SEQUENCE[idx];
}

const STATUS_META: Record<Status, { label: string; chip: string; dot: string }> = {
  draft:     { label: "Drafting",  chip: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",          dot: "bg-zinc-400" },
  sending:   { label: "Sending",   chip: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",     dot: "bg-amber-500 animate-pulse" },
  delivered: { label: "Delivered", chip: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  opened:    { label: "Opened",    chip: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",         dot: "bg-blue-500 animate-pulse" },
  replied:   { label: "Replied",   chip: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
};

export function ApplicationsAnimation({ active = true }: { active?: boolean }) {
  const [tick, setTick] = useState(0);
  const [counts, setCounts] = useState({ sent: 47, replies: 8, interviews: 3 });

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setCounts((c) => ({
        sent: c.sent + 1,
        replies: c.replies + (Math.random() < 0.3 ? 1 : 0),
        interviews: c.interviews + (Math.random() < 0.1 ? 1 : 0),
      }));
    }, 3500);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-br from-amber-500/10 via-emerald-400/10 to-blue-400/10 rounded-[2rem] blur-3xl pointer-events-none" />
      <div className="relative rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/70 dark:ring-zinc-800 shadow-2xl shadow-emerald-500/10 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 ml-2">
            JobPilot · Applications · this week
          </span>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-emerald-500 font-semibold uppercase tracking-wider">SMTP</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 p-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-2 ring-1 ring-zinc-200/50 dark:ring-zinc-700/30">
            <p className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600">Sent</p>
            <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-white">{counts.sent}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40">
            <p className="text-[9px] uppercase tracking-wider text-emerald-700/70 dark:text-emerald-300/70">Replies</p>
            <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{counts.replies}</p>
          </div>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-2 ring-1 ring-blue-200/60 dark:ring-blue-800/40">
            <p className="text-[9px] uppercase tracking-wider text-blue-700/70 dark:text-blue-300/70">Interviews</p>
            <p className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-300">{counts.interviews}</p>
          </div>
        </div>

        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {ROWS.map((r) => {
            const s = statusOf(r, tick);
            const meta = STATUS_META[s];
            return (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">{r.role}</p>
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate">{r.company}</p>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider rounded px-2 py-0.5 ring-1 ring-inset ring-transparent ${meta.chip}`}>
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/40">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-500 flex items-center justify-between">
            <span>Bounce? Auto-pause. Reply? Push notification.</span>
            <span className="tabular-nums">Sent from your Gmail</span>
          </p>
        </div>
      </div>
    </div>
  );
}
