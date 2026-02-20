import Link from "next/link";
import { AnimateOnScroll } from "./AnimateOnScroll";

function MockCard({
  title,
  company,
  score,
  color,
}: {
  title: string;
  company: string;
  score: number;
  color: "emerald" | "amber";
}) {
  const barColor = color === "emerald" ? "bg-emerald-500" : "bg-amber-400";
  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/80 p-2.5 ring-1 ring-zinc-100 dark:ring-zinc-700/50">
      <p className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">
        {title}
      </p>
      <p className="text-[9px] text-zinc-400 dark:text-zinc-500">{company}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="flex-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-[8px] font-bold text-zinc-500 dark:text-zinc-400 tabular-nums">
          {score}%
        </span>
      </div>
    </div>
  );
}

function KanbanMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-amber-400/20 dark:from-emerald-500/10 dark:via-emerald-400/5 dark:to-amber-400/10 rounded-3xl blur-2xl" />
      <div className="relative rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-zinc-200/50 dark:ring-zinc-700/50 overflow-hidden transform -rotate-1 hover:rotate-0 transition-transform duration-500">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 ml-2">
            JobPilot — Job Pipeline
          </span>
        </div>
        <div className="p-4 flex gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">Saved</span>
              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded px-1">3</span>
            </div>
            <div className="space-y-2">
              <MockCard title="Senior React Dev" company="Vercel" score={95} color="emerald" />
              <MockCard title="Full Stack Eng" company="Stripe" score={82} color="emerald" />
              <MockCard title="Node.js Backend" company="Shopify" score={71} color="amber" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">Applied</span>
              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded px-1">2</span>
            </div>
            <div className="space-y-2">
              <MockCard title="Frontend Eng" company="Linear" score={88} color="emerald" />
              <MockCard title="TS Developer" company="Supabase" score={76} color="amber" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">Interview</span>
              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded px-1">1</span>
            </div>
            <div className="space-y-2">
              <MockCard title="React Native" company="Expo" score={91} color="emerald" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-white dark:bg-zinc-950">
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-amber-400/10 dark:bg-amber-400/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <AnimateOnScroll>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  AI-powered job applications
                </span>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={100}>
              <h1
                className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white leading-[1.1]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Stop Applying Blindly.
                <br />
                <span className="bg-gradient-to-r from-emerald-600 to-emerald-400 dark:from-emerald-400 dark:to-emerald-300 bg-clip-text text-transparent">
                  Start Landing Interviews.
                </span>
              </h1>
            </AnimateOnScroll>

            <AnimateOnScroll delay={200}>
              <p className="mt-6 text-lg text-zinc-500 dark:text-zinc-400 max-w-lg leading-relaxed">
                JobPilot finds jobs that match{" "}
                <strong className="text-zinc-700 dark:text-zinc-300">your skills</strong>,
                writes personalized emails, and tracks every application — so you never miss an opportunity.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={300}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Get Started Free
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white ring-1 ring-zinc-200 dark:ring-zinc-800 hover:ring-zinc-300 dark:hover:ring-zinc-700 transition-all"
                >
                  See How It Works
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                  </svg>
                </a>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={400}>
              <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm text-zinc-500 dark:text-zinc-400">
                {["No credit card required", "AI-powered email generation", "Works with Gmail"].map((t) => (
                  <span key={t} className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {t}
                  </span>
                ))}
              </div>
            </AnimateOnScroll>
          </div>

          <AnimateOnScroll delay={300} className="lg:pl-4">
            <div className="animate-[landing-float_6s_ease-in-out_infinite]">
              <KanbanMockup />
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}
