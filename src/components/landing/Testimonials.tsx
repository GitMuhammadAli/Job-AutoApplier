"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { AnimateOnScroll } from "./AnimateOnScroll";

function TestimonialCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    el.style.transform = `perspective(600px) rotateX(${(0.5 - y) * 6}deg) rotateY(${(x - 0.5) * 6}deg) translateY(-4px)`;
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(600px) rotateX(0deg) rotateY(0deg) translateY(0)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="transition-transform duration-300 ease-out h-full"
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

const SCENARIOS = [
  {
    emoji: "\uD83D\uDCBB",
    name: "Ahmad",
    role: "Fresh Graduate, Lahore",
    quote: "I set my keywords to React and Node.js. In 2 weeks, I applied to 40 companies and got 3 interview calls. JobPilot saved me hours every day.",
    color: "bg-blue-500",
    gradient: "from-blue-500/10 to-cyan-500/5",
  },
  {
    emoji: "\uD83C\uDF0D",
    name: "Sarah",
    role: "Remote Developer, Karachi",
    quote: "I was spending 3 hours daily on Indeed and LinkedIn. Now JobPilot does it in the background while I code. The AI emails actually sound professional.",
    color: "bg-violet-500",
    gradient: "from-violet-500/10 to-purple-500/5",
  },
  {
    emoji: "\uD83C\uDFAF",
    name: "Usman",
    role: "Senior Engineer, Job Switcher",
    quote: "The AI emails sound like ME. Not robotic, not generic. HR responded to 4 out of 20 applications. Best tool I used during my job search.",
    color: "bg-emerald-500",
    gradient: "from-emerald-500/10 to-teal-500/5",
  },
];

export function Testimonials() {
  return (
    <section className="py-24 md:py-32 bg-zinc-50/80 dark:bg-zinc-900/30 relative overflow-hidden">
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-6">
        <AnimateOnScroll variant="blur-in">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
            Use Cases
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold text-center text-zinc-900 dark:text-white tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            How people use JobPilot
          </h2>
        </AnimateOnScroll>

        <div className="mt-16 grid md:grid-cols-3 gap-6 [perspective:1200px]">
          {SCENARIOS.map((s, i) => (
            <AnimateOnScroll key={s.name} delay={i * 150} variant="flip-up">
              <TestimonialCard>
                <div className={`rounded-2xl bg-gradient-to-br ${s.gradient} p-[1px] h-full`}>
                  <div className="rounded-2xl bg-white dark:bg-zinc-900 p-6 ring-1 ring-zinc-100/50 dark:ring-zinc-800/50 h-full flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-11 h-11 rounded-full ${s.color} flex items-center justify-center text-lg shadow-lg`}>
                        {s.emoji}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{s.name}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.role}</p>
                      </div>
                    </div>
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <svg key={j} className="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed italic flex-1">
                      &ldquo;{s.quote}&rdquo;
                    </p>
                  </div>
                </div>
              </TestimonialCard>
            </AnimateOnScroll>
          ))}
        </div>

        <AnimateOnScroll delay={500}>
          <p className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
            * Scenarios represent typical use cases. Results vary based on market, skills, and location.
          </p>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
