import Link from "next/link";
import { AnimateOnScroll } from "./AnimateOnScroll";

export function CTA() {
  return (
    <section className="py-24 md:py-32 bg-zinc-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.12),transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <AnimateOnScroll>
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Ready to stop wasting time on job applications?
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={100}>
          <p className="mt-6 text-lg text-zinc-400 max-w-lg mx-auto">
            Sign up in 30 seconds. Set your preferences. Let AI handle the rest.
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={200}>
          <div className="mt-10">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all hover:scale-[1.03] active:scale-[0.98]"
            >
              Get Started Free
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll delay={300}>
          <p className="mt-6 text-sm text-zinc-500">
            Free forever. No credit card. Cancel anytime.
          </p>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
