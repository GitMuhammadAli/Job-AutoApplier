"use client";

import { AnimateOnScroll } from "./AnimateOnScroll";

const TRUST_POINTS = [
  { icon: "\uD83D\uDD12", text: "Emails send from YOUR Gmail \u2014 not a random server", glow: "hover:shadow-blue-500/10" },
  { icon: "\uD83D\uDEE1\uFE0F", text: "Rate limiting: max 20/day, 8/hour \u2014 protects your inbox reputation", glow: "hover:shadow-emerald-500/10" },
  { icon: "\uD83D\uDD10", text: "SMTP passwords encrypted with AES-256 at rest", glow: "hover:shadow-violet-500/10" },
  { icon: "\uD83D\uDCE7", text: "Auto-pause on bounces \u2014 stops before any damage", glow: "hover:shadow-amber-500/10" },
  { icon: "\uD83D\uDC41\uFE0F", text: "Review every email before sending in Semi-Auto mode", glow: "hover:shadow-cyan-500/10" },
  { icon: "\u23F8\uFE0F", text: "Pause anytime \u2014 one click to freeze everything", glow: "hover:shadow-rose-500/10" },
];

export function Safety() {
  return (
    <section className="py-24 md:py-32 bg-stone-950 relative overflow-hidden">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] bg-emerald-500/[0.05] rounded-full blur-[160px]" />
      <div className="pointer-events-none absolute top-0 right-0 w-[320px] h-[320px] bg-amber-400/[0.04] rounded-full blur-[120px]" />

      <div className="relative mx-auto max-w-4xl px-6">
        <AnimateOnScroll variant="blur-in">
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-400 mb-3">
            Safety & trust
          </p>
          <h2
            className="text-3xl md:text-4xl font-semibold text-center text-stone-50 tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Built with your reputation in mind.
          </h2>
        </AnimateOnScroll>

        <div className="mt-14 grid sm:grid-cols-2 gap-4">
          {TRUST_POINTS.map((point, i) => (
            <AnimateOnScroll key={i} delay={i * 100} variant={i % 2 === 0 ? "fade-left" : "fade-right"}>
              <div className={`group flex items-start gap-4 rounded-2xl p-4 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-soft-lg ${point.glow} bg-stone-100/[0.04] border border-stone-100/[0.08] backdrop-blur-sm hover:bg-stone-100/[0.07] hover:border-stone-100/[0.14]`}>
                <span className="text-2xl flex-shrink-0 group-hover:scale-110 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">{point.icon}</span>
                <p className="text-sm text-stone-300 leading-relaxed group-hover:text-stone-50 transition-colors duration-500">{point.text}</p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
