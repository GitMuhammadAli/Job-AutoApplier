import { AnimateOnScroll } from "./AnimateOnScroll";

const PAIN_POINTS = [
  {
    emoji: "\u{1F629}",
    title: "Searching 8 job sites every day",
    desc: "Indeed, LinkedIn, Rozee... the tabs never end. You spend hours scrolling and still miss listings.",
  },
  {
    emoji: "\u{1F630}",
    title: "Writing the same email over and over",
    desc: "Copy, paste, change the company name. Generic applications that get ignored by recruiters.",
  },
  {
    emoji: "\u{1F624}",
    title: "Tracking 50+ applications in a spreadsheet",
    desc: "\"Did I already apply here?\" You can't remember. Your spreadsheet is chaos. You lose track.",
  },
];

export function ProblemSolution() {
  return (
    <section className="py-24 md:py-32 bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="relative mx-auto max-w-6xl px-6">
        <AnimateOnScroll>
          <p
            className="text-center text-2xl md:text-3xl lg:text-4xl text-white/90 max-w-2xl mx-auto leading-snug font-medium italic"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            &ldquo;Job searching shouldn&apos;t feel like a second job.&rdquo;
          </p>
        </AnimateOnScroll>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {PAIN_POINTS.map((p, i) => (
            <AnimateOnScroll key={i} delay={i * 120}>
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-6 text-center hover:bg-white/[0.06] transition-colors">
                <span className="text-4xl">{p.emoji}</span>
                <h3 className="mt-4 text-sm font-semibold text-white/90">{p.title}</h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{p.desc}</p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>

        <AnimateOnScroll delay={400}>
          <div className="mt-14 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
              </svg>
            </div>
            <p
              className="text-2xl md:text-3xl font-bold text-white"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              JobPilot does all of this.{" "}
              <span className="text-emerald-400">Automatically.</span>
            </p>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
