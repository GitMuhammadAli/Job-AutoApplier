"use client";

import { cloneElement, isValidElement, ReactElement, ReactNode, useEffect, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { fonts } from "@/styles/tokens";

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
      className="relative py-32 md:py-40 bg-stone-50 dark:bg-stone-950 border-t border-stone-200/60 dark:border-stone-900/60"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${side === "right" ? "lg:[&>div:first-child]:order-2" : ""}`}>
          {/* Animation */}
          <div
            className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${hasBeenSeen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
            data-active={active}
          >
            {animationChild}
          </div>

          {/* Copy */}
          <div
            className={`transition-all duration-700 delay-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${hasBeenSeen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          >
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[11px] font-medium tabular-nums tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                {number}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500 dark:text-stone-500">
                {eyebrow}
              </span>
              {comingSoon && (
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 ring-1 ring-amber-200/50 dark:ring-amber-900/40 rounded-full px-2 py-0.5">
                  Coming soon
                </span>
              )}
            </div>

            <h3
              className="text-3xl md:text-4xl lg:text-[2.75rem] tracking-[-0.025em] text-stone-900 dark:text-stone-50 leading-[1.05]"
              style={{ fontFamily: fonts.display, fontWeight: 600 }}
            >
              {title}
            </h3>

            <p className="mt-5 text-base md:text-lg text-stone-600 dark:text-stone-400 leading-[1.65]">
              {body}
            </p>

            {bullets.length > 0 && (
              <ul className="mt-6 space-y-2.5">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-stone-700 dark:text-stone-300">
                    <Check size={16} className="mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            {ctaLabel && ctaHref && (
              <div className="mt-7">
                <a
                  href={ctaHref}
                  className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200 transition-colors duration-300 group focus-soft"
                >
                  {ctaLabel}
                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-0.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
