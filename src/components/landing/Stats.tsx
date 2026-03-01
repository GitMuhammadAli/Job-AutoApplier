"use client";

import { AnimateOnScroll } from "./AnimateOnScroll";
import { StatsCounter } from "./StatsCounter";

const STATS = [
  { value: 8, suffix: "+", label: "Job Sources", gradient: "from-blue-500 to-cyan-400" },
  { value: 6, suffix: "", label: "Kanban Stages", gradient: "from-violet-500 to-purple-400" },
  { value: 3, suffix: "", label: "Apply Modes", gradient: "from-amber-500 to-orange-400" },
  { value: 5, suffix: " min", prefix: "< ", label: "Setup Time", gradient: "from-emerald-500 to-teal-400" },
  { value: 7, suffix: "", label: "Analytics Charts", gradient: "from-pink-500 to-rose-400" },
  { value: 15, suffix: "", label: "Settings Sections", gradient: "from-indigo-500 to-blue-400" },
  { value: 100, suffix: "%", label: "Free", gradient: "from-emerald-500 to-lime-400" },
  { value: 1000, suffix: "+", label: "Jobs Tracked", gradient: "from-orange-500 to-amber-400" },
];

export function Stats() {
  return (
    <section className="py-24 md:py-32 bg-white dark:bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-6">
        <AnimateOnScroll variant="flip-up">
          <h2
            className="text-3xl md:text-4xl font-bold text-center text-zinc-900 dark:text-white tracking-tight mb-16"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            JobPilot by the numbers.
          </h2>
        </AnimateOnScroll>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
          {STATS.map((stat, i) => (
            <AnimateOnScroll key={stat.label} delay={i * 80} variant="zoom">
              <div className="group relative text-center rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-5 ring-1 ring-zinc-100 dark:ring-zinc-800 hover:ring-zinc-200 dark:hover:ring-zinc-700 transition-all duration-500 hover:-translate-y-1 hover:shadow-lg">
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500`} />
                <p className={`relative text-3xl md:text-4xl font-bold tabular-nums bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                  <StatsCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix || ""} />
                </p>
                <p className="relative mt-1.5 text-sm text-zinc-500 dark:text-zinc-400 font-medium">{stat.label}</p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
