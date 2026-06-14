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
    <section id="modes" className="py-24 md:py-32 bg-stone-50 dark:bg-stone-950 relative overflow-hidden">
      <div className="pointer-events-none absolute top-1/3 right-0 w-[420px] h-[420px] bg-amber-400/[0.06] dark:bg-amber-400/[0.04] rounded-full blur-[140px]" />

      <div className="relative mx-auto max-w-6xl px-6">
        <AnimateOnScroll variant="flip-up">
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400 mb-3">
            Automation modes
          </p>
          <h2
            className="text-3xl md:text-4xl font-semibold text-center text-stone-900 dark:text-stone-50 tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Choose your level of automation.
          </h2>
          <p className="mt-4 text-center text-[15px] text-stone-500 dark:text-stone-400 max-w-lg mx-auto leading-relaxed">
            Start with Manual. Upgrade to Semi-Auto when you're ready. You're always in control.
          </p>
        </AnimateOnScroll>

        <div className="mt-16 grid md:grid-cols-3 gap-5 [perspective:1200px]">
          {MODES.map((mode, i) => (
            <AnimateOnScroll key={mode.name} delay={i * 150} variant="flip-up">
              <ModeTiltCard recommended={mode.recommended} className="h-full">
                <div
                  className={`relative rounded-2xl p-6 h-full flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    mode.recommended
                      ? "bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 ring-2 ring-emerald-500/70 shadow-soft-xl"
                      : `bg-gradient-to-b ${mode.gradient} ring-1 ring-stone-200/60 dark:ring-stone-800/60 hover:ring-stone-300/60 dark:hover:ring-stone-700/60 hover:shadow-soft-md`
                  }`}
                >
                  {mode.recommended && (
                    <>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-[10px] font-medium text-stone-50 uppercase tracking-[0.12em] shadow-soft-md">
                        Recommended
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-transparent to-emerald-500/10 animate-pulse-soft pointer-events-none" />
                    </>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-2.5 h-2.5 rounded-full ${mode.dot} ${mode.recommended ? "animate-pulse-soft" : ""}`} />
                    <h3 className="text-lg font-medium">{mode.name}</h3>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        mode.recommended
                          ? "bg-stone-100/20 dark:bg-stone-900/20 text-stone-50/90 dark:text-stone-900/90"
                          : mode.badgeColor
                      }`}
                    >
                      {mode.badge}
                    </span>
                  </div>

                  <p
                    className={`text-sm leading-relaxed mb-5 ${
                      mode.recommended
                        ? "text-stone-50/75 dark:text-stone-900/75"
                        : "text-stone-500 dark:text-stone-400"
                    }`}
                  >
                    {mode.desc}
                  </p>

                  <ul className="space-y-2.5 flex-1">
                    {mode.details.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-sm">
                        <svg
                          className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                            mode.recommended ? "text-emerald-400 dark:text-emerald-600" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <span className={mode.recommended ? "text-stone-50/85 dark:text-stone-900/85" : "text-stone-600 dark:text-stone-300"}>
                          {d}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div
                    className={`mt-6 py-2.5 text-center rounded-lg text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      mode.recommended
                        ? "bg-emerald-500 text-stone-50 hover:bg-emerald-400 shadow-soft-md hover:shadow-soft-lg"
                        : "bg-stone-100 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300 hover:bg-stone-200/80 dark:hover:bg-stone-800"
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
