"use client";

import Link from "next/link";
import { ArrowRight, ArrowDown, Check, Sparkles } from "lucide-react";
import { AnimateOnScroll } from "./AnimateOnScroll";
import { PipelineDemo } from "./PipelineDemo";

const PROOF_POINTS = [
  { label: "9 sources", detail: "scraped hourly" },
  { label: "16 templates", detail: "ATS-clean" },
  { label: "4-agent pipeline", detail: "researches each company" },
];

export function Hero() {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center pt-16 overflow-hidden bg-white dark:bg-zinc-950">
      {/* Subtle ambient gradient — one soft layer */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-20 h-[480px] w-[480px] rounded-full bg-emerald-200/30 dark:bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[380px] w-[380px] rounded-full bg-amber-100/30 dark:bg-amber-500/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-24 w-full" style={{ fontFamily: "var(--font-sans-pro)" }}>
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-14 items-center">
          {/* Left column */}
          <div>
            <AnimateOnScroll>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-zinc-900/80 px-3 py-1.5 ring-1 ring-zinc-200 dark:ring-zinc-800 backdrop-blur-sm mb-6">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.2} />
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 tracking-wide">
                  Open-source · self-hostable · free forever
                </span>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={100}>
              <h1
                className="text-[2.75rem] sm:text-6xl md:text-7xl font-bold tracking-[-0.025em] text-zinc-900 dark:text-white leading-[0.95]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                One tab.
                <br />
                Every job site.
                <br />
                <span className="text-emerald-600 dark:text-emerald-400">Your Gmail.</span>
              </h1>
            </AnimateOnScroll>

            <AnimateOnScroll delay={200}>
              <p className="mt-7 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-lg leading-[1.55]">
                JobPilot scans <strong className="font-semibold text-zinc-900 dark:text-zinc-100">9 job sites</strong>, scores every role against your resume, drafts a personal email in your voice, and sends it from <strong className="font-semibold text-zinc-900 dark:text-zinc-100">your Gmail</strong>. No spreadsheets. No spam.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={300}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2 rounded-full bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 px-7 py-3.5 text-sm font-semibold text-white dark:text-zinc-900 shadow-lg transition-all hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]"
                >
                  <span>Get started free</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.2} />
                </Link>
                <a
                  href="#modules"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white ring-1 ring-zinc-200 dark:ring-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  See how it works
                  <ArrowDown className="h-4 w-4" strokeWidth={2.2} />
                </a>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={400}>
              <div className="mt-10 grid grid-cols-3 gap-x-4 gap-y-2 max-w-md">
                {PROOF_POINTS.map((p) => (
                  <div key={p.label} className="border-l border-zinc-200 dark:border-zinc-800 pl-3">
                    <p
                      className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tabular-nums"
                      style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                    >
                      {p.label}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-500 leading-tight">
                      {p.detail}
                    </p>
                  </div>
                ))}
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={500}>
              <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5 text-[13px] text-zinc-500 dark:text-zinc-500">
                {["No credit card", "Sends from your Gmail", "Apache 2.0"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" strokeWidth={2.5} />
                    {t}
                  </span>
                ))}
              </div>
            </AnimateOnScroll>
          </div>

          {/* Right column — live pipeline */}
          <AnimateOnScroll delay={300} className="lg:pl-4">
            <PipelineDemo />
          </AnimateOnScroll>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-600">
        <span>Scroll to see each module</span>
        <ArrowDown className="h-3 w-3 animate-bounce" strokeWidth={2} />
      </div>
    </section>
  );
}
