"use client";

import Link from "next/link";
import { AnimateOnScroll } from "./AnimateOnScroll";

export function CTA() {
  return (
    <section className="py-24 md:py-32 bg-zinc-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.12),transparent_70%)] pointer-events-none" />

      {/* Flowing curves */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 1440 500" fill="none">
        <path
          d="M-50,400 C200,300 500,450 800,350 C1100,250 1300,380 1500,300"
          stroke="url(#cta-curve-1)"
          strokeWidth="1.2"
          className="animate-curve-drift-1"
          opacity="0.2"
        />
        <path
          d="M-50,200 C300,120 600,280 900,180 C1200,80 1350,220 1500,150"
          stroke="url(#cta-curve-1)"
          strokeWidth="0.8"
          className="animate-curve-drift-2"
          opacity="0.12"
        />
        <defs>
          <linearGradient id="cta-curve-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="30%" stopColor="#10b981" stopOpacity="1" />
            <stop offset="70%" stopColor="#14b8a6" stopOpacity="1" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <AnimateOnScroll variant="zoom">
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Ready to stop wasting time on{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_200%]">
              job applications
            </span>
            ?
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={150} variant="blur-in">
          <p className="mt-6 text-lg text-zinc-400 max-w-lg mx-auto">
            Sign up in 30 seconds. Set your preferences. Let AI handle the rest.
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={300} variant="zoom">
          <div className="mt-10">
            <Link
              href="/login"
              className="group relative inline-flex items-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all hover:scale-[1.05] active:scale-[0.98] overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-white/25 to-emerald-400/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="absolute inset-0 rounded-full ring-2 ring-emerald-400/50 animate-pulse-slow pointer-events-none" />
              <span className="relative">Get Started Free</span>
              <svg
                className="h-5 w-5 relative group-hover:translate-x-1 transition-transform duration-300"
                fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll delay={450}>
          <p className="mt-6 text-sm text-zinc-500">
            Free forever. No credit card. Cancel anytime.
          </p>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
