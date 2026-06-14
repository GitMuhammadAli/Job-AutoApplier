"use client";

/**
 * Page transition wrapper.
 *
 * Uses the Cross-Document View Transitions API when supported (Chrome 126+,
 * Edge, Safari 17.4+). Gracefully degrades to a tiny opacity/translate fade
 * on Firefox + older browsers, driven by tailwind animation tokens.
 *
 * Aesthetic: the user's stated end-goal — "smooth UI and all the
 * transitions and animations like FAANG". Stone-warm timing, no rubber-band
 * jank, no layout-thrash.
 *
 * Place once inside the dashboard layout, wrapping children. The hook
 * `useViewTransitionLink` lets <Link> handlers opt nav into the transition.
 */

import * as React from "react";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [displayedPath, setDisplayedPath] = React.useState(pathname);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (pathname === displayedPath) return;

    if (typeof document !== "undefined" && document.startViewTransition) {
      const t = document.startViewTransition(() => {
        setDisplayedPath(pathname);
      });
      // Avoid an unhandled rejection if the user navigates again mid-flight.
      t.finished.catch(() => {});
      return;
    }
    setDisplayedPath(pathname);
  }, [pathname, displayedPath]);

  React.useEffect(() => {
    // Lightweight Firefox fallback — replay the fade-up on path change.
    if (typeof document !== "undefined" && !document.startViewTransition) {
      const el = containerRef.current;
      if (!el) return;
      el.classList.remove("animate-page-enter");
      // Force reflow to restart the animation.
      void el.offsetWidth;
      el.classList.add("animate-page-enter");
    }
  }, [displayedPath]);

  return (
    <div
      ref={containerRef}
      data-page-transition
      style={{ viewTransitionName: "page-content" }}
      className="contents"
    >
      {children}
    </div>
  );
}

/**
 * Returns a click handler that wraps `cb()` (typically a router.push) in a
 * view transition when supported. Use this for in-app links/CTAs where the
 * default <Link> nav misses the transition (e.g. programmatic nav).
 */
export function useViewTransition() {
  return React.useCallback((cb: () => void) => {
    if (typeof document !== "undefined" && document.startViewTransition) {
      document.startViewTransition(cb);
      return;
    }
    cb();
  }, []);
}
