"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimateOnScroll } from "./AnimateOnScroll";

const FAQS = [
  {
    q: "Is it really free?",
    a: "Yes. All features are free right now. We may add premium tiers later, but the core product will always have a generous free tier.",
  },
  {
    q: "Will my emails go to spam?",
    a: "No — because emails send from YOUR Gmail account, not a third-party server. HR sees your real email address, exactly like you sent it manually.",
  },
  {
    q: "Do I need to give my Gmail password?",
    a: "No. You create a Google App Password — a separate 16-character key for third-party apps. Your actual Gmail password is never stored or seen by JobPilot.",
  },
  {
    q: "Can I use Manual mode without connecting email?",
    a: "Absolutely. Manual mode needs zero email setup. AI writes emails, you click 'Copy All', paste into Gmail, and send yourself. Full control.",
  },
  {
    q: "What job sites does it search?",
    a: "Indeed, LinkedIn, Remotive, Rozee.pk, Arbeitnow, Google Jobs, Adzuna, and JSearch — 8+ sources aggregated and deduplicated for you.",
  },
  {
    q: "Is my data safe?",
    a: "SMTP passwords are encrypted with AES-256 at rest. We never sell data. You can export all your data or delete your account anytime.",
  },
  {
    q: "Does it work for non-tech jobs?",
    a: "Yes. Set your keywords to anything — marketing, sales, design, finance, writing. The matching engine and AI work for any field.",
  },
  {
    q: "Can I use it from Pakistan?",
    a: "Built for Pakistani job seekers. Includes Rozee.pk, supports PKR salary display, Lahore/Karachi/Islamabad location matching, and optional Urdu email generation.",
  },
];

export function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 md:py-32 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-6">
        <AnimateOnScroll>
          <h2 className="text-3xl md:text-4xl font-bold text-center text-zinc-900 dark:text-white tracking-tight mb-4"
              style={{ fontFamily: "var(--font-serif)" }}>
            Frequently Asked Questions
          </h2>
          <p className="text-center text-zinc-500 dark:text-zinc-400 mb-12 max-w-lg mx-auto">
            Everything you need to know about JobPilot.
          </p>
        </AnimateOnScroll>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {FAQS.map((faq, i) => (
            <AnimateOnScroll key={i} delay={i * 50}>
              <div className="py-5">
                <button
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  className="flex justify-between items-center w-full text-left gap-4 group"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 flex-shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform duration-300 ${
                      openIdx === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-300 ease-out ${
                    openIdx === i
                      ? "grid-rows-[1fr] opacity-100 mt-3"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
