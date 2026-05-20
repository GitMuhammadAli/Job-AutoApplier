"use client";

import Link from "next/link";
import { ArrowRight, ArrowDown, Check } from "@phosphor-icons/react";
import { AnimateOnScroll } from "./AnimateOnScroll";
import { PipelineDemo } from "./PipelineDemo";
import { fonts } from "@/styles/tokens";

/**
 * Product facts only. No invented usage stats.
 * If a number lives here, it must be derivable from code (template count, scraper count).
 */
const PROOF_POINTS = [
  { number: "9",  label: "job sources",  detail: "scraped hourly" },
  { number: "16", label: "ATS templates", detail: "single + two-column" },
  { number: "4",  label: "agents",        detail: "research · tailor · write · QA" },
];

export function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-white dark:bg-zinc-950 pt-28 sm:pt-32 md:pt-40 pb-24 sm:pb-32 md:pb-40"
      style={{ fontFamily: fonts.body }}
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-12 sm:gap-14 lg:gap-16 items-center">
          {/* Left column — copy. Asymmetric: left-aligned, no centered theatre. */}
          <div>
            <AnimateOnScroll>
              <div className="inline-flex items-center gap-2 mb-7 sm:mb-8">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
                  Open-source · self-hostable · free forever
                </span>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={80}>
              <h1
                className="text-[2.75rem] sm:text-[3.75rem] md:text-[5rem] lg:text-[6rem] xl:text-[7rem] tracking-[-0.03em] text-zinc-900 dark:text-white leading-[0.92]"
                style={{ fontFamily: fonts.display, fontWeight: 600 }}
              >
                Apply to 50 jobs
                <br />
                in 30 minutes.
              </h1>
            </AnimateOnScroll>

            <AnimateOnScroll delay={140}>
              <p
                className="mt-5 sm:mt-6 text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] tracking-[-0.02em] leading-[1.05] text-zinc-400 dark:text-zinc-600"
                style={{ fontFamily: fonts.display, fontWeight: 500 }}
              >
                Land <span className="text-emerald-600 dark:text-emerald-400">real offers.</span>
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={220}>
              <p className="mt-7 sm:mt-9 text-base sm:text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl leading-[1.55]">
                JobPilot scans <strong className="font-semibold text-zinc-900 dark:text-zinc-100">9 job sites</strong>, scores every role against your resume, drafts a personal email in your voice, and sends it from <strong className="font-semibold text-zinc-900 dark:text-zinc-100">your Gmail</strong> — all in one tab.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={300}>
              <div className="mt-9 sm:mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2 rounded-full bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 px-7 sm:px-8 py-4 text-sm sm:text-base font-semibold text-white dark:text-zinc-900 transition-colors"
                >
                  <span>Get started free</span>
                  <ArrowRight size={18} weight="regular" className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a
                  href="#modules"
                  className="inline-flex items-center gap-2 rounded-full px-6 sm:px-7 py-4 text-sm sm:text-base font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white ring-1 ring-zinc-200 dark:ring-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  See how it works
                  <ArrowDown size={18} weight="regular" />
                </a>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={380}>
              <div className="mt-12 sm:mt-14 grid grid-cols-3 gap-x-5 sm:gap-x-8 max-w-md">
                {PROOF_POINTS.map((p) => (
                  <div key={p.label} className="border-l-2 border-zinc-200 dark:border-zinc-800 pl-3 sm:pl-4">
                    <p
                      className="text-2xl sm:text-3xl text-zinc-900 dark:text-white tabular-nums leading-none"
                      style={{ fontFamily: fonts.display, fontWeight: 600 }}
                    >
                      {p.number}
                    </p>
                    <p className="mt-1.5 text-[11px] sm:text-xs text-zinc-700 dark:text-zinc-300 leading-tight font-medium">
                      {p.label}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-zinc-400 dark:text-zinc-600 leading-tight mt-0.5">
                      {p.detail}
                    </p>
                  </div>
                ))}
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={440}>
              <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5 text-[13px] sm:text-sm text-zinc-500 dark:text-zinc-500">
                {["No credit card", "Sends from your Gmail", "Apache 2.0"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check size={15} weight="bold" className="text-emerald-500 flex-shrink-0" />
                    {t}
                  </span>
                ))}
              </div>
            </AnimateOnScroll>
          </div>

          {/* Right column — live pipeline */}
          <AnimateOnScroll delay={240} className="lg:pl-4">
            <PipelineDemo />
          </AnimateOnScroll>
        </div>
      </div>

      {/* Scroll cue — bottom-left, asymmetric */}
      <div className="absolute bottom-8 left-6 md:left-10 hidden md:flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-600">
        <span>Scroll to see each module</span>
        <ArrowDown size={12} weight="regular" className="animate-bounce" />
      </div>
    </section>
  );
}
