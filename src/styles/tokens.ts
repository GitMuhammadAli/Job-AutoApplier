/**
 * Design tokens — single source of truth for the landing (and gradually the dashboard).
 *
 * Why this file exists:
 *   Every component that picks a font, an icon, or a spacing value reads from here.
 *   No raw font names ("Inter", "Clash Display") in JSX. No raw imports of lucide-react.
 *   Change a token here → it propagates everywhere it's referenced.
 *
 * Rules locked by user (2026-05-21):
 *   - Display: Clash Display (self-hosted, free commercial via Fontshare)
 *   - Body:    General Sans (self-hosted, same family-feel as Clash)
 *   - Mono:    JetBrains Mono (Google Fonts via next/font/google)
 *   - Inter and Geist are dropped — they read as "AI default"
 *   - Icons:   Lucide (single weight, consistent stroke)
 *   - Clash Display has narrow x-height — do not use below 24px
 *   - The PDF resume template stays on Space Grotesk + DM Sans (ATS-safe, separate type system)
 *
 * The actual fonts are loaded in `src/app/layout.tsx` via next/font/local
 * and exposed as CSS variables `--font-display`, `--font-body`, `--font-mono`.
 * This module imports nothing — it's pure data + types so it can be used in
 * both server and client components.
 */

export const fonts = {
  /** Headlines, large numbers, marquee callouts. ONLY at 24px and above. */
  display: "var(--font-display)",
  /** Body copy, UI text, small labels. Default for everything else. */
  body: "var(--font-body)",
  /** Code, file paths, monospace data (counters, IDs, kbd shortcuts). */
  mono: "var(--font-mono)",
} as const;

export type FontToken = keyof typeof fonts;

/**
 * Icon system: Lucide. Imported as a barrel from
 * lucide-react with explicit per-icon imports to keep the bundle thin.
 *
 * Rule: Lucide has a single stroke weight family-wide. If a callout needs
 * more emphasis, use `bold` text/border around the icon, NOT a different
 * icon weight (Lucide doesn't support per-icon weights anyway).
 */
export const icons = {
  /** Hover/spark accent for badges (never paired with sparkle emoji). */
  spark: "Sparkles",
  /** Forward CTA arrow. */
  arrowRight: "ArrowRight",
  /** Scroll cue / accordion expand. */
  arrowDown: "ArrowDown",
  /** Bullet checks, feature lists. */
  check: "Check",
  /** Sources, scrapers, discovery. */
  globe: "Globe",
  /** Kanban / pipeline. */
  kanban: "Kanban",
  /** Resume / document. */
  fileText: "FileText",
  /** Email / send. */
  paperPlane: "Send",
  /** Templates. */
  envelope: "Mail",
  /** Analytics. */
  chartLine: "LineChart",
  /** System health / pulse. */
  activity: "Activity",
} as const;

export type IconToken = keyof typeof icons;

/**
 * Spacing scale — used for section vertical padding.
 *
 * User-locked: no section padding under 100px. Push to 120–160px.
 * Tailwind: py-32 = 128px, py-40 = 160px.
 */
export const spacing = {
  sectionY: "py-32 md:py-40",      // 128–160px vertical, the new baseline
  sectionXContainer: "px-6 mx-auto max-w-6xl",
} as const;

/**
 * Color: emerald is the only brand accent. Greys carry the page.
 * No pastel orbs in backgrounds. No gradient text on headlines.
 */
export const palette = {
  brand: "emerald", // resolves to text-emerald-600 / dark:text-emerald-400 etc.
  // No "from-emerald via-teal to-amber" gradients on type. Solid only.
} as const;
