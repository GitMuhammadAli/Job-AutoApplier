import { AnimateOnScroll } from "./AnimateOnScroll";

const STEPS = [
  { num: "01", title: "Sign up with Google", desc: "One click. No forms. No email verification.", accent: "bg-blue-500" },
  { num: "02", title: "Set your preferences", desc: "Keywords, location, experience level, preferred platforms — tell JobPilot what you want.", accent: "bg-violet-500" },
  { num: "03", title: "Upload your resume", desc: "AI detects your skills automatically. Upload multiple resumes for different roles.", accent: "bg-amber-500" },
  { num: "04", title: "Jobs appear on your Kanban", desc: "Scored 0-100, sorted by relevance. Only jobs that match your profile make the cut.", accent: "bg-emerald-500" },
  { num: "05", title: "Apply with one click", desc: "AI writes the email. Copy All, paste in Gmail, send. Or let JobPilot send directly. Done.", accent: "bg-rose-500" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-zinc-50/80 dark:bg-zinc-900/30">
      <div className="mx-auto max-w-3xl px-6">
        <AnimateOnScroll>
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
          <div className="absolute left-5 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800 md:left-1/2 md:-translate-x-px" />
          <div className="space-y-12">
            {STEPS.map((step, i) => {
              const isEven = i % 2 === 0;
              return (
                <AnimateOnScroll key={step.num} delay={i * 120}>
                  <div className="relative flex items-start gap-6 md:gap-0">
                    <div className="absolute left-5 md:left-1/2 -translate-x-1/2 z-10">
                      <div className={`w-10 h-10 rounded-full ${step.accent} flex items-center justify-center shadow-lg`}>
                        <span className="text-xs font-bold text-white">{step.num}</span>
                      </div>
                    </div>
                    <div className={`ml-16 md:ml-0 md:w-1/2 ${isEven ? "md:pr-16 md:text-right" : "md:pl-16 md:ml-auto"}`}>
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{step.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{step.desc}</p>
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
