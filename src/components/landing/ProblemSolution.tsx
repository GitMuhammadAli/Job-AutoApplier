"use client";

import { AnimateOnScroll } from "./AnimateOnScroll";

const PAIN_POINTS = [
  {
    emoji: "\u{1F629}",
    title: "Searching 8 job sites every day",
    desc: "Indeed, LinkedIn, Rozee... the tabs never end. You spend hours scrolling and still miss listings.",
    glow: "from-red-500/20 via-orange-500/10 to-transparent",
  },
  {
    emoji: "\u{1F630}",
    title: "Writing the same email over and over",
    desc: "Copy, paste, change the company name. Generic applications that get ignored by recruiters.",
    glow: "from-amber-500/20 via-yellow-500/10 to-transparent",
  },
  {
    emoji: "\u{1F624}",
    title: "Tracking 50+ applications in a spreadsheet",
    desc: "\"Did I already apply here?\" You can't remember. Your spreadsheet is chaos. You lose track.",
    glow: "from-rose-500/20 via-pink-500/10 to-transparent",
  },
];

export function ProblemSolution() {
  return (
    <section className="py-24 md:py-32 bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-6">
        <AnimateOnScroll variant="blur-in">
          <p
            className="text-center text-2xl md:text-3xl lg:text-4xl text-white/90 max-w-2xl mx-auto leading-snug font-medium italic"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            &ldquo;Job searching shouldn&apos;t feel like a second job.&rdquo;
          </p>
        </AnimateOnScroll>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {PAIN_POINTS.map((p, i) => (
            <AnimateOnScroll key={i} delay={i * 150} variant="flip-up">
              <div className="group relative rounded-2xl p-6 text-center transition-all duration-500 hover:-translate-y-2">
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${p.glow} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl`} />
                <div className="relative rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6 backdrop-blur-sm hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-500">
                  <span className="text-5xl block group-hover:scale-110 transition-transform duration-500">{p.emoji}</span>
                  <h3 className="mt-4 text-sm font-semibold text-white/90">{p.title}</h3>
                  <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>

        <AnimateOnScroll delay={500} variant="zoom">
          <div className="mt-14 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6 relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" />
              <svg className="h-5 w-5 text-emerald-400 relative" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
              </svg>
            </div>
            <p
              className="text-2xl md:text-3xl font-bold text-white"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              JobPilot does all of this.{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_200%]">
                Automatically.
              </span>
            </p>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
