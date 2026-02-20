import { AnimateOnScroll } from "./AnimateOnScroll";

const TRUST_POINTS = [
  { icon: "\uD83D\uDD12", text: "Emails send from YOUR Gmail \u2014 not a random server" },
  { icon: "\uD83D\uDEE1\uFE0F", text: "Rate limiting: max 20/day, 8/hour \u2014 protects your inbox reputation" },
  { icon: "\uD83D\uDD10", text: "SMTP passwords encrypted with AES-256 at rest" },
  { icon: "\uD83D\uDCE7", text: "Auto-pause on bounces \u2014 stops before any damage" },
  { icon: "\uD83D\uDC41\uFE0F", text: "Review every email before sending in Semi-Auto mode" },
  { icon: "\u23F8\uFE0F", text: "Pause anytime \u2014 one click to freeze everything" },
];

export function Safety() {
  return (
    <section className="py-24 md:py-32 bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="relative mx-auto max-w-4xl px-6">
        <AnimateOnScroll>
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3">
            Safety & Trust
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold text-center text-white tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Built with your reputation in mind.
          </h2>
        </AnimateOnScroll>

        <div className="mt-14 grid sm:grid-cols-2 gap-4">
          {TRUST_POINTS.map((point, i) => (
            <AnimateOnScroll key={i} delay={i * 80}>
              <div className="flex items-start gap-4 rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 hover:bg-white/[0.06] transition-colors">
                <span className="text-xl flex-shrink-0">{point.icon}</span>
                <p className="text-sm text-zinc-300 leading-relaxed">{point.text}</p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
