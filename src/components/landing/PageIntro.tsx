"use client";

import { fonts } from "@/styles/tokens";

interface PageIntroProps {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
}

/**
 * Shared header for the standalone /features, /how-it-works, /modes, /faq pages.
 * Same design language as the home Hero — Clash Display, no centered theatre,
 * asymmetric two-column body.
 */
export function PageIntro({ eyebrow, title, body }: PageIntroProps) {
  return (
    <section
      className="relative overflow-hidden bg-white dark:bg-zinc-950 pt-32 sm:pt-40 md:pt-48 pb-20 sm:pb-28 md:pb-32"
      style={{ fontFamily: fonts.body }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-10 items-end">
          <div>
            <div className="inline-flex items-center gap-2 mb-7">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
                {eyebrow}
              </span>
            </div>
            <h1
              className="text-[2.5rem] sm:text-6xl md:text-[5rem] lg:text-[6rem] tracking-[-0.03em] text-zinc-900 dark:text-white leading-[0.92]"
              style={{ fontFamily: fonts.display, fontWeight: 600 }}
            >
              {title}
            </h1>
          </div>
          <p className="text-base sm:text-lg md:text-xl text-zinc-600 dark:text-zinc-400 leading-[1.55] max-w-md lg:ml-auto">
            {body}
          </p>
        </div>
      </div>
    </section>
  );
}
