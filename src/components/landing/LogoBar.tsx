import { AnimateOnScroll } from "./AnimateOnScroll";

const PLATFORMS = [
  "Indeed",
  "LinkedIn",
  "Remotive",
  "Rozee.pk",
  "Arbeitnow",
  "Google Jobs",
  "Adzuna",
  "JSearch",
];

export function LogoBar() {
  return (
    <section className="py-14 bg-zinc-50/80 dark:bg-zinc-900/50 border-y border-zinc-100 dark:border-zinc-800/50">
      <div className="mx-auto max-w-6xl px-6">
        <AnimateOnScroll>
          <p className="text-center text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-8">
            Aggregates from 8+ job platforms
          </p>
        </AnimateOnScroll>
        <AnimateOnScroll delay={100}>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 md:gap-x-12">
            {PLATFORMS.map((name) => (
              <span
                key={name}
                className="text-sm md:text-base font-semibold text-zinc-300 dark:text-zinc-700 select-none"
              >
                {name}
              </span>
            ))}
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
