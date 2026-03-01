"use client";

import { AnimateOnScroll } from "./AnimateOnScroll";

const STEPS = [
  { num: "01", title: "Sign up with Google", desc: "One click. No forms. No email verification.", accent: "bg-blue-500", glow: "shadow-blue-500/30" },
  { num: "02", title: "Set your preferences", desc: "Keywords, location, experience level, preferred platforms \u2014 tell JobPilot what you want.", accent: "bg-violet-500", glow: "shadow-violet-500/30" },
  { num: "03", title: "Upload your resume", desc: "AI detects your skills automatically. Upload multiple resumes for different roles.", accent: "bg-amber-500", glow: "shadow-amber-500/30" },
  { num: "04", title: "Jobs appear on your Kanban", desc: "Scored 0-100, sorted by relevance. Only jobs that match your profile make the cut.", accent: "bg-emerald-500", glow: "shadow-emerald-500/30" },
  { num: "05", title: "Apply with one click", desc: "AI writes the email. Copy All, paste in Gmail, send. Or let JobPilot send directly. Done.", accent: "bg-rose-500", glow: "shadow-rose-500/30" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-zinc-50/80 dark:bg-zinc-900/30 relative overflow-hidden">
      <div className="absolute top-1/4 left-0 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative mx-auto max-w-3xl px-6">
        <AnimateOnScroll variant="flip-up">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
            How It Works
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold text-center text-zinc-900 dark:text-white tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Up and running in 5 minutes.
          </h2>
        </AnimateOnScroll>

        <div className="mt-16 relative">
          <div className="absolute left-5 top-0 bottom-0 w-px md:left-1/2 md:-translate-x-px overflow-hidden">
            <div className="w-full h-full bg-gradient-to-b from-blue-500/40 via-violet-500/40 via-amber-500/40 via-emerald-500/40 to-rose-500/40" />
          </div>

          <div className="space-y-14">
            {STEPS.map((step, i) => {
              const isEven = i % 2 === 0;
              return (
                <AnimateOnScroll key={step.num} delay={i * 150} variant={isEven ? "fade-left" : "fade-right"}>
                  <div className="relative flex items-start gap-6 md:gap-0 group">
                    <div className="absolute left-5 md:left-1/2 -translate-x-1/2 z-10">
                      <div className="relative">
                        <div className={`absolute inset-0 rounded-full ${step.accent} opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500`} />
                        <div className={`relative w-11 h-11 rounded-full ${step.accent} flex items-center justify-center shadow-lg ${step.glow} group-hover:scale-110 transition-transform duration-300`}>
                          <span className="text-xs font-bold text-white">{step.num}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`ml-16 md:ml-0 md:w-1/2 ${isEven ? "md:pr-16 md:text-right" : "md:pl-16 md:ml-auto"}`}>
                      <div className="group-hover:-translate-y-1 transition-transform duration-300">
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{step.title}</h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  </div>
                </AnimateOnScroll>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
