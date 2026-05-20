"use client";

import { cloneElement, isValidElement, ReactElement, ReactNode, useEffect, useRef, useState } from "react";

interface ModuleSectionProps {
  id: string;
  number: string;
  eyebrow: string;
  title: ReactNode;
  body: string;
  bullets?: string[];
  ctaLabel?: string;
  ctaHref?: string;
  side?: "left" | "right";
  children: ReactNode;
  comingSoon?: boolean;
}

/**
 * Each module gets one ModuleSection. The animation lives in `children`.
 *
 * Performance contract:
 *   - Animations only START when the section enters the viewport.
 *   - Animations PAUSE when the section leaves the viewport.
 *   - At most ~2 animations run simultaneously (current + next).
 *   - The child receives an `active` boolean prop; it must clear its
 *     own intervals/timeouts when `active === false`.
 */
export function ModuleSection({
  id,
  number,
  eyebrow,
  title,
  body,
  bullets = [],
  ctaLabel,
  ctaHref,
  side = "left",
  children,
  comingSoon = false,
}: ModuleSectionProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hasBeenSeen, setHasBeenSeen] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActive(true);
            setHasBeenSeen(true);
          } else {
            setActive(false);
          }
        }
      },
      { rootMargin: "0px 0px -20% 0px", threshold: [0, 0.1, 0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const animationChild = isValidElement(children)
    ? cloneElement(children as ReactElement<{ active?: boolean }>, { active })
    : children;

  return (
    <section
      id={id}
      ref={ref}
      className="relative py-20 md:py-28 border-t border-zinc-100 dark:border-zinc-900"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${side === "right" ? "lg:[&>div:first-child]:order-2" : ""}`}>
          {/* Animation */}
          <div
            className={`transition-all duration-700 ${hasBeenSeen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
            data-active={active}
          >
            {animationChild}
          </div>

          {/* Copy */}
          <div className={`transition-all duration-700 delay-150 ${hasBeenSeen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-bold tabular-nums tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                {number}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
                {eyebrow}
              </span>
              {comingSoon && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200/60 dark:ring-amber-800/40 rounded-full px-2 py-0.5">
                  Coming soon
                </span>
              )}
            </div>

            <h3
              className="text-3xl md:text-4xl lg:text-[2.5rem] font-bold tracking-tight text-zinc-900 dark:text-white leading-[1.1]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {title}
            </h3>

            <p className="mt-5 text-base md:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {body}
            </p>

            {bullets.length > 0 && (
              <ul className="mt-6 space-y-2.5">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                    <svg className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            {ctaLabel && ctaHref && (
              <div className="mt-7">
                <a
                  href={ctaHref}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors group"
                >
                  {ctaLabel}
                  <svg className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
