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
      className="relative overflow-hidden bg-stone-50 dark:bg-stone-950 pt-28 sm:pt-32 md:pt-36 pb-24 sm:pb-28 md:pb-32"
      style={{ fontFamily: fonts.body }}
    >
      {/* Atmospheric wash — desaturated orbs over warm stone */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="pointer-events-none absolute -top-32 -right-40 h-[520px] w-[520px] rounded-full bg-emerald-500/[0.06] dark:bg-emerald-500/[0.04] blur-[160px]" />
      <div className="pointer-events-none absolute top-1/3 -left-32 h-[400px] w-[400px] rounded-full bg-amber-300/[0.08] dark:bg-amber-300/[0.04] blur-[140px]" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 sm:gap-12 lg:gap-14 items-start">
          {/* Left column */}
          <div>
            <AnimateOnScroll>
              <div className="inline-flex items-center gap-2 mb-6 sm:mb-7">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500 dark:text-stone-500">
                  Open-source · self-hostable · free forever
                </span>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={80}>
              <h1
                className="text-[2.75rem] sm:text-[3.5rem] md:text-[4.25rem] lg:text-[4.75rem] xl:text-[5.5rem] tracking-[-0.03em] text-stone-900 dark:text-stone-50 leading-[0.95]"
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
                <span className="text-stone-400 dark:text-stone-600">Land </span>
                <span className="text-emerald-700 dark:text-emerald-400">{phrase}</span>
                <span className="inline-block w-[2px] h-[0.85em] bg-emerald-500 dark:bg-emerald-400 ml-1 align-middle animate-pulse-soft" />
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={240}>
              <p className="mt-6 sm:mt-7 text-base sm:text-lg text-stone-600 dark:text-stone-400 max-w-xl leading-[1.65]">
                JobPilot scans{" "}
                <span className="font-medium text-stone-900 dark:text-stone-100">9 job sites</span>,
                scores every role against your resume, drafts a personal email in your voice,
                and sends it from{" "}
                <span className="font-medium text-stone-900 dark:text-stone-100">your Gmail</span>{" "}
                — all in one tab.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={320}>
              <div className="mt-7 sm:mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2 rounded-full bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-stone-200 px-6 sm:px-7 py-3.5 text-[14px] font-medium text-stone-50 dark:text-stone-900 shadow-soft-md hover:shadow-soft-lg transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-soft tap-44"
                >
                  <span>Get started free</span>
                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-0.5 transition-transform duration-300"
                  />
                </Link>
                <a
                  href="#modules"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-medium text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 border border-stone-200 dark:border-stone-800 hover:bg-white/60 dark:hover:bg-stone-900/60 transition-all duration-300 focus-soft tap-44"
                >
                  See how it works
                  <ArrowDown size={16} />
                </a>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={400}>
              <div className="mt-8 sm:mt-9 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-5 text-[13px] text-stone-500 dark:text-stone-500">
                {["Free forever", "No credit card", "Sends from your Gmail"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    {t}
                  </span>
                ))}
              </div>
            </AnimateOnScroll>
          </div>

          {/* Right column — live pipeline. */}
          <AnimateOnScroll delay={240} className="lg:mt-12">
            <PipelineDemo />
          </AnimateOnScroll>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-6 md:left-10 hidden md:flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-stone-400 dark:text-stone-600">
        <span>Scroll to see each module</span>
        <ArrowDown size={12} className="animate-bounce" />
      </div>
    </section>
  );
}
