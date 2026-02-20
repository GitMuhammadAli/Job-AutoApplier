import { AnimateOnScroll } from "./AnimateOnScroll";

const SELLING_POINTS = [
  "Scrapes Rozee.pk - Pakistan's #1 job board",
  "PKR salary display alongside USD",
  "Lahore, Karachi, Islamabad location matching",
  "Remote-first: find global opportunities from Pakistan",
];

export function Pakistan() {
  return (
    <section className="py-24 md:py-32 bg-emerald-50/50 dark:bg-emerald-950/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.08),transparent_60%)] pointer-events-none" />
      <div className="relative mx-auto max-w-4xl px-6">
        <AnimateOnScroll>
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-4xl" role="img" aria-label="Pakistan flag">&#127477;&#127472;</span>
            <h2
              className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Built for Pakistan&apos;s tech talent.
            </h2>
          </div>
        </AnimateOnScroll>

        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          {SELLING_POINTS.map((point, i) => (
            <AnimateOnScroll key={i} delay={i * 100}>
              <div className="flex items-start gap-3 rounded-xl bg-white dark:bg-zinc-900/60 p-4 ring-1 ring-emerald-100 dark:ring-emerald-900/30 hover:ring-emerald-200 dark:hover:ring-emerald-800/40 transition-colors">
                <svg className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{point}</span>
              </div>
            </AnimateOnScroll>
          ))}
        </div>

        <AnimateOnScroll delay={500}>
          <p
            className="mt-12 text-center text-lg text-zinc-500 dark:text-zinc-400 italic max-w-md mx-auto"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            &ldquo;Pakistani engineers deserve the same tools as Silicon Valley.&rdquo;
          </p>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
