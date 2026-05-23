"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowDown, Check } from "lucide-react";
import { AnimateOnScroll } from "./AnimateOnScroll";
import { PipelineDemo } from "./PipelineDemo";
import { fonts } from "@/styles/tokens";

const ROTATING_PHRASES = [
  "interviews.",
  "callbacks.",
  "real offers.",
  "the right job.",
];

function useRotatingPhrase(
  phrases: string[],
  typingSpeed = 70,
  deleteSpeed = 35,
  pauseMs = 1800,
) {
  const [display, setDisplay] = useState("");
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = phrases[wordIdx];
    const t = setTimeout(
      () => {
        if (!deleting) {
          setDisplay(word.slice(0, charIdx + 1));
          if (charIdx + 1 === word.length) {
            setTimeout(() => setDeleting(true), pauseMs);
          } else {
            setCharIdx((c) => c + 1);
          }
        } else {
          setDisplay(word.slice(0, charIdx));
          if (charIdx === 0) {
            setDeleting(false);
            setWordIdx((i) => (i + 1) % phrases.length);
          } else {
            setCharIdx((c) => c - 1);
          }
        }
      },
      deleting ? deleteSpeed : typingSpeed,
    );
    return () => clearTimeout(t);
  }, [charIdx, deleting, wordIdx, phrases, typingSpeed, deleteSpeed, pauseMs]);

  return display;
}

export function Hero() {
  const phrase = useRotatingPhrase(ROTATING_PHRASES);

  return (
    <section
      className="relative overflow-hidden bg-white dark:bg-zinc-950 pt-28 sm:pt-32 md:pt-36 pb-24 sm:pb-28 md:pb-32"
      style={{ fontFamily: fonts.body }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 sm:gap-12 lg:gap-14 items-start">
          {/* Left column */}
          <div>
            <AnimateOnScroll>
              <div className="inline-flex items-center gap-2 mb-6 sm:mb-7">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
                  Open-source · self-hostable · free forever
                </span>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={80}>
              <h1
                className="text-[2.75rem] sm:text-[3.5rem] md:text-[4.25rem] lg:text-[4.75rem] xl:text-[5.5rem] tracking-[-0.03em] text-zinc-900 dark:text-white leading-[0.95]"
                style={{ fontFamily: fonts.display, fontWeight: 600 }}
              >
                Apply to 50 jobs
                <br />
                in 30 minutes.
              </h1>
            </AnimateOnScroll>

            <AnimateOnScroll delay={160}>
              <p
                className="mt-4 sm:mt-5 text-xl sm:text-2xl md:text-[1.75rem] lg:text-3xl tracking-[-0.02em] leading-[1.1]"
                style={{ fontFamily: fonts.display, fontWeight: 500 }}
              >
                <span className="text-zinc-400 dark:text-zinc-600">Land </span>
                <span className="text-emerald-600 dark:text-emerald-400">{phrase}</span>
                <span className="inline-block w-[2px] h-[0.85em] bg-emerald-500 dark:bg-emerald-400 ml-1 align-middle animate-pulse" />
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={240}>
              <p className="mt-6 sm:mt-7 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-xl leading-[1.6]">
                JobPilot scans <strong className="font-semibold text-zinc-900 dark:text-zinc-100">9 job sites</strong>, scores every role against your resume, drafts a personal email in your voice, and sends it from <strong className="font-semibold text-zinc-900 dark:text-zinc-100">your Gmail</strong> — all in one tab.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={320}>
              <div className="mt-7 sm:mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2 rounded-full bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 px-6 sm:px-7 py-3.5 text-sm font-semibold text-white dark:text-zinc-900 transition-colors"
                >
                  <span>Get started free</span>
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a
                  href="#modules"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white ring-1 ring-zinc-200 dark:ring-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  See how it works
                  <ArrowDown size={16} />
                </a>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={400}>
              <div className="mt-8 sm:mt-9 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5 text-[13px] text-zinc-500 dark:text-zinc-500">
                {["Free forever", "No credit card", "Sends from your Gmail"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-500 flex-shrink-0" />
                    {t}
                  </span>
                ))}
              </div>
            </AnimateOnScroll>
          </div>

          {/* Right column — live pipeline. Sticks to top of column on lg, top-aligns with H1 baseline. */}
          <AnimateOnScroll delay={240} className="lg:mt-12">
            <PipelineDemo />
          </AnimateOnScroll>
        </div>
      </div>

      {/* Scroll cue — bottom-left, asymmetric */}
      <div className="absolute bottom-8 left-6 md:left-10 hidden md:flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-600">
        <span>Scroll to see each module</span>
        <ArrowDown size={12} className="animate-bounce" />
      </div>
    </section>
  );
}
