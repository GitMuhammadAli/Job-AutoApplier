"use client";

import { AnimateOnScroll } from "./AnimateOnScroll";

const PLATFORMS = [
  { name: "Indeed", icon: "🔍" },
  { name: "LinkedIn", icon: "💼" },
  { name: "Remotive", icon: "🌍" },
  { name: "Rozee.pk", icon: "🇵🇰" },
  { name: "Arbeitnow", icon: "🇪🇺" },
  { name: "Google Jobs", icon: "🔎" },
  { name: "Adzuna", icon: "📊" },
  { name: "JSearch", icon: "⚡" },
];

function MarqueeRow({ direction = "left" }: { direction?: "left" | "right" }) {
  const items = [...PLATFORMS, ...PLATFORMS];

  return (
    <div className="relative overflow-hidden" style={{ maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}>
      <div
        className="flex gap-6 md:gap-10 w-max"
        style={{
          animation: `marquee ${direction === "left" ? "25s" : "30s"} linear infinite`,
          animationDirection: direction === "right" ? "reverse" : "normal",
        }}
      >
        {items.map((p, i) => (
          <div
            key={`${p.name}-${i}`}
            className="flex items-center gap-2.5 rounded-full bg-white dark:bg-zinc-900 px-5 py-2.5 ring-1 ring-zinc-100 dark:ring-zinc-800 shadow-sm hover:shadow-md hover:ring-emerald-200 dark:hover:ring-emerald-800/40 transition-all duration-300 hover:-translate-y-0.5 select-none"
          >
            <span className="text-lg">{p.icon}</span>
            <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
              {p.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LogoBar() {
  return (
    <section className="py-14 bg-zinc-50/80 dark:bg-zinc-900/50 border-y border-zinc-100 dark:border-zinc-800/50 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6">
        <AnimateOnScroll>
          <p className="text-center text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-8">
            Aggregates from 8+ job platforms in real-time
          </p>
        </AnimateOnScroll>
      </div>
      <AnimateOnScroll delay={100}>
        <MarqueeRow direction="left" />
      </AnimateOnScroll>
    </section>
  );
}
