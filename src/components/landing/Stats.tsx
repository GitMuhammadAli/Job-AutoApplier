import { AnimateOnScroll } from "./AnimateOnScroll";
import { StatsCounter } from "./StatsCounter";

const STATS = [
  { value: 8, suffix: "+", label: "Job Sources" },
  { value: 6, suffix: "", label: "Kanban Stages" },
  { value: 3, suffix: "", label: "Apply Modes" },
  { value: 5, suffix: " min", prefix: "< ", label: "Setup Time" },
  { value: 7, suffix: "", label: "Analytics Charts" },
  { value: 15, suffix: "", label: "Settings Sections" },
  { value: 100, suffix: "%", label: "Free" },
  { value: 1000, suffix: "+", label: "Jobs Tracked" },
];

export function Stats() {
  return (
    <section className="py-24 md:py-32 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-6">
        <AnimateOnScroll>
          <h2
            className="text-3xl md:text-4xl font-bold text-center text-zinc-900 dark:text-white tracking-tight mb-16"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            JobPilot by the numbers.
          </h2>
        </AnimateOnScroll>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {STATS.map((stat, i) => (
            <AnimateOnScroll key={stat.label} delay={i * 60}>
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white tabular-nums">
                  <StatsCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix || ""} />
                </p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
