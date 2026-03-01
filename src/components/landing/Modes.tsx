"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { AnimateOnScroll } from "./AnimateOnScroll";

function ModeTiltCard({ children, recommended, className = "" }: { children: ReactNode; recommended: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateX = (0.5 - y) * (recommended ? 10 : 8);
    const rotateY = (x - 0.5) * (recommended ? 10 : 8);
    el.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${recommended ? 20 : 10}px)`;
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`transition-transform duration-300 ease-out ${className}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

const MODES = [
  {
    name: "Manual",
    badge: "Safe",
    badgeColor: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    desc: "Browse matched jobs. AI writes the email. Copy & paste into Gmail yourself.",
    details: ["No email setup needed", "Full control over every email", "Perfect for getting started"],
    recommended: false,
    gradient: "from-emerald-500/5 to-teal-500/5",
  },
  {
    name: "Semi-Auto",
    badge: "Smart",
    badgeColor: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-400",
    desc: "AI writes personalized emails for you. Review each one. Click Send when ready.",
    details: ["Gmail App Password required", "Review before sending", "Best balance of speed & control"],
    recommended: true,
    gradient: "from-amber-500/10 to-orange-500/10",
  },
  {
    name: "Full-Auto",
    badge: "Bold",
    badgeColor: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    desc: "AI finds, writes, and sends \u2014 you just set preferences and monitor results.",
    details: ["Built-in safety limits", "Pause anytime, one click", "Max 20/day, 8/hour protection"],
    recommended: false,
    gradient: "from-rose-500/5 to-pink-500/5",
  },
];

export function Modes() {
  return (
    <section id="modes" className="py-24 md:py-32 bg-white dark:bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-6">
        <AnimateOnScroll variant="flip-up">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
            Automation Modes
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold text-center text-zinc-900 dark:text-white tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Choose your level of automation.
          </h2>
          <p className="mt-4 text-center text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
            Start with Manual. Upgrade to Semi-Auto when you&apos;re ready. You&apos;re always in control.
          </p>
        </AnimateOnScroll>

        <div className="mt-16 grid md:grid-cols-3 gap-5 [perspective:1200px]">
          {MODES.map((mode, i) => (
            <AnimateOnScroll key={mode.name} delay={i * 150} variant="flip-up">
              <ModeTiltCard recommended={mode.recommended} className="h-full">
                <div
                  className={`relative rounded-2xl p-6 h-full flex flex-col transition-all duration-300 ${
                    mode.recommended
                      ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 ring-2 ring-emerald-500 shadow-xl shadow-emerald-500/10"
                      : `bg-gradient-to-b ${mode.gradient} ring-1 ring-zinc-100 dark:ring-zinc-800 hover:ring-zinc-200 dark:hover:ring-zinc-700 hover:shadow-lg`
                  }`}
                >
                  {mode.recommended && (
                    <>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide shadow-lg shadow-emerald-500/30">
                        Recommended
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-transparent to-emerald-500/10 animate-pulse-slow pointer-events-none" />
                    </>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-3 h-3 rounded-full ${mode.dot} ${mode.recommended ? "animate-pulse" : ""}`} />
                    <h3 className="text-lg font-bold">{mode.name}</h3>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        mode.recommended
                          ? "bg-white/20 dark:bg-zinc-900/20 text-white/90 dark:text-zinc-900/90"
                          : mode.badgeColor
                      }`}
                    >
                      {mode.badge}
                    </span>
                  </div>

                  <p
                    className={`text-sm leading-relaxed mb-5 ${
                      mode.recommended
                        ? "text-white/70 dark:text-zinc-900/70"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {mode.desc}
                  </p>

                  <ul className="space-y-2.5 flex-1">
                    {mode.details.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-sm">
                        <svg
                          className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                            mode.recommended ? "text-emerald-400 dark:text-emerald-600" : "text-emerald-500"
                          }`}
                          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <span className={mode.recommended ? "text-white/80 dark:text-zinc-900/80" : "text-zinc-600 dark:text-zinc-300"}>
                          {d}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div
                    className={`mt-6 py-2.5 text-center rounded-lg text-sm font-semibold transition-all duration-300 ${
                      mode.recommended
                        ? "bg-emerald-500 text-white dark:text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    Free
                  </div>
                </div>
              </ModeTiltCard>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
