import { AnimateOnScroll } from "./AnimateOnScroll";

const SCENARIOS = [
  {
    emoji: "\uD83D\uDCBB",
    name: "Ahmad",
    role: "Fresh Graduate, Lahore",
    quote: "I set my keywords to React and Node.js. In 2 weeks, I applied to 40 companies and got 3 interview calls. JobPilot saved me hours every day.",
    color: "bg-blue-500",
  },
  {
    emoji: "\uD83C\uDF0D",
    name: "Sarah",
    role: "Remote Developer, Karachi",
    quote: "I was spending 3 hours daily on Indeed and LinkedIn. Now JobPilot does it in the background while I code. The AI emails actually sound professional.",
    color: "bg-violet-500",
  },
  {
    emoji: "\uD83C\uDFAF",
    name: "Usman",
    role: "Senior Engineer, Job Switcher",
    quote: "The AI emails sound like ME. Not robotic, not generic. HR responded to 4 out of 20 applications. Best tool I used during my job search.",
    color: "bg-emerald-500",
  },
];

export function Testimonials() {
  return (
    <section className="py-24 md:py-32 bg-zinc-50/80 dark:bg-zinc-900/30">
      <div className="mx-auto max-w-6xl px-6">
        <AnimateOnScroll>
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

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {SCENARIOS.map((s, i) => (
            <AnimateOnScroll key={s.name} delay={i * 120}>
              <div className="rounded-2xl bg-white dark:bg-zinc-900/60 p-6 ring-1 ring-zinc-100 dark:ring-zinc-800 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full ${s.color} flex items-center justify-center text-lg`}>
                    {s.emoji}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{s.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.role}</p>
                  </div>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed italic flex-1">
                  &ldquo;{s.quote}&rdquo;
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>

        <AnimateOnScroll delay={400}>
          <p className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
            * Scenarios represent typical use cases. Results vary based on market, skills, and location.
          </p>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
