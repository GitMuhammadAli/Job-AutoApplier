"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GlowingOrbs } from "./GlowingOrbs";
import { Tilt3D } from "./Tilt3D";
import { AnimateOnScroll } from "./AnimateOnScroll";

const TYPING_WORDS = ["Interviews.", "Callbacks.", "Offers.", "Results."];

function useTypingEffect(words: string[], typingSpeed = 80, deleteSpeed = 40, pauseMs = 2000) {
  const [display, setDisplay] = useState("");
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[wordIdx];
    const timeout = setTimeout(() => {
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
          setWordIdx((i) => (i + 1) % words.length);
        } else {
          setCharIdx((c) => c - 1);
        }
      }
    }, deleting ? deleteSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [charIdx, deleting, wordIdx, words, typingSpeed, deleteSpeed, pauseMs]);

  return display;
}

function FloatingBadge({ children, className, delay }: { children: React.ReactNode; className: string; delay: number }) {
  return (
    <div
      className={`absolute hidden lg:flex items-center gap-2 rounded-full px-3 py-1.5 shadow-lg backdrop-blur-md ring-1 text-xs font-medium ${className}`}
      style={{
        animation: `landing-float 5s ease-in-out ${delay}s infinite`,
        zIndex: 2,
      }}
    >
      {children}
    </div>
  );
}

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
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/80 p-2.5 ring-1 ring-zinc-100 dark:ring-zinc-700/50 transition-all duration-300 hover:scale-[1.03] hover:shadow-md">
      <p className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">
        {title}
      </p>
      <p className="text-[9px] text-zinc-400 dark:text-zinc-500">{company}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="flex-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-1000`}
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
    <Tilt3D intensity={8} className="w-full">
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-amber-400/20 dark:from-emerald-500/10 dark:via-emerald-400/5 dark:to-amber-400/10 rounded-3xl blur-2xl animate-pulse-slow" />
        <div className="absolute -inset-[1px] bg-gradient-to-r from-emerald-500/30 via-transparent to-amber-400/30 rounded-2xl" />
        <div className="relative rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl shadow-emerald-500/10 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 ml-2">
              JobPilot — Job Pipeline
            </span>
            <div className="ml-auto flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] text-emerald-500 font-medium">Live</span>
            </div>
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
    </Tilt3D>
  );
}

export function Hero() {
  const typedWord = useTypingEffect(TYPING_WORDS);

  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-white dark:bg-zinc-950">
      <GlowingOrbs />

      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "40px 40px",
          zIndex: 0,
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28" style={{ zIndex: 2 }}>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <AnimateOnScroll>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 mb-6 backdrop-blur-sm">
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
                <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-300 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_200%]">
                  Start Landing{" "}
                </span>
                <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-300 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_200%]">
                  {typedWord}
                </span>
                <span className="inline-block w-[3px] h-[0.9em] bg-emerald-500 dark:bg-emerald-400 ml-0.5 animate-pulse align-middle" />
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
                  className="group relative inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-white/20 to-emerald-400/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <span className="relative">Get Started Free</span>
                  <svg className="h-4 w-4 relative group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white ring-1 ring-zinc-200 dark:ring-zinc-800 hover:ring-zinc-300 dark:hover:ring-zinc-700 transition-all hover:shadow-md"
                >
                  See How It Works
                  <svg className="h-4 w-4 animate-bounce" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
            <div className="relative">
              <FloatingBadge className="bg-emerald-50/90 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 ring-emerald-200/50 dark:ring-emerald-800/40 -top-6 -left-4" delay={0}>
                <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                95% Match
              </FloatingBadge>
              <FloatingBadge className="bg-amber-50/90 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 ring-amber-200/50 dark:ring-amber-800/40 -bottom-4 -right-2" delay={1.5}>
                <svg className="h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
                AI Generated
              </FloatingBadge>
              <FloatingBadge className="bg-blue-50/90 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 ring-blue-200/50 dark:ring-blue-800/40 top-1/2 -right-8" delay={3}>
                <svg className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
                Auto Sent
              </FloatingBadge>
              <KanbanMockup />
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}
