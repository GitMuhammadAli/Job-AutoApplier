/**
 * Shaped skeleton loaders.
 *
 * Rule: every skeleton must match the actual rendered shape so there's no
 * layout shift when the real data lands. The product-specific blocks
 * (`ApplicationCardSkeleton`, `JobCardSkeleton`, `ResumePreviewSkeleton`)
 * mirror the dimensions of their counterparts on `/applications`,
 * `/recommended` + `/jobs`, and `/resumes/tailor` respectively.
 *
 * The pulse animation is a custom 1.5s zinc-100 ↔ zinc-200 loop (Tailwind's
 * default `animate-pulse` is 2s + opacity-based) emitted as a single inline
 * `<style>` block at module scope. No external libs, no global CSS changes
 * required.
 */
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Pulse animation                                                    */
/* ------------------------------------------------------------------ */
/* Injected once via a `<style>` tag inside the root Skeleton component.
   Kept here (not in globals.css) so this file is self-contained — drop it
   anywhere and it works. The keyframes shift the background between the
   two zinc shades; `dark:` variants override to zinc-700 ↔ zinc-800 for
   contrast on dark backgrounds. */
const PULSE_CSS = `
@keyframes skeletonPulse {
  0%, 100% { background-color: rgb(244 244 245); }   /* zinc-100 */
  50%      { background-color: rgb(228 228 231); }   /* zinc-200 */
}
@keyframes skeletonPulseDark {
  0%, 100% { background-color: rgb(63 63 70); }      /* zinc-700 */
  50%      { background-color: rgb(39 39 42); }      /* zinc-800 */
}
.jp-skeleton {
  animation: skeletonPulse 1.5s ease-in-out infinite;
  will-change: background-color;
}
@media (prefers-color-scheme: dark) {
  .jp-skeleton { animation-name: skeletonPulseDark; }
}
.dark .jp-skeleton { animation-name: skeletonPulseDark; }
@media (prefers-reduced-motion: reduce) {
  .jp-skeleton { animation: none; background-color: rgb(228 228 231); }
  .dark .jp-skeleton { background-color: rgb(63 63 70); }
}
`;

let stylesInjected = false;
function useSkeletonStyles() {
  // Render the style tag exactly once per app — repeated <style> tags with
  // identical content are valid but noisy in devtools. Using a module-level
  // boolean keeps it server-safe (each request gets a fresh module on the
  // server in dev; the client mount injects once and skips on rerender).
  if (typeof window !== "undefined" && stylesInjected) return null;
  stylesInjected = true;
  return <style dangerouslySetInnerHTML={{ __html: PULSE_CSS }} />;
}

/* ------------------------------------------------------------------ */
/*  Building blocks                                                    */
/* ------------------------------------------------------------------ */

export interface SkeletonProps {
  className?: string;
  /** Tailwind height token or CSS length, e.g. "h-4" or "1rem". */
  height?: string;
  /** Tailwind width token or CSS length, e.g. "w-full" or "12rem". */
  width?: string;
}

/**
 * Generic rectangle skeleton. Defaults to h-4 w-full rounded-md so it
 * stands in for a single line of body text without further props.
 */
export function Skeleton({ className, height, width }: SkeletonProps) {
  // height/width can be either Tailwind utility classes (caller's choice)
  // or raw CSS lengths — detect by presence of a hyphen-leading token.
  const isHeightClass = !!height && /^[a-z]/i.test(height);
  const isWidthClass = !!width && /^[a-z]/i.test(width);
  const style: React.CSSProperties = {};
  if (height && !isHeightClass) style.height = height;
  if (width && !isWidthClass) style.width = width;
  return (
    <>
      {useSkeletonStyles()}
      <div
        aria-hidden="true"
        style={style}
        className={cn(
          "jp-skeleton rounded-md",
          !height && "h-4",
          !width && "w-full",
          isHeightClass && height,
          isWidthClass && width,
          className,
        )}
      />
    </>
  );
}

export interface SkeletonTextProps {
  /** Number of lines. Defaults to 3. Last line is shorter for realism. */
  lines?: number;
  className?: string;
}

/** Paragraph-shaped skeleton with a shortened last line. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  const safe = Math.max(1, lines);
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: safe }).map((_, i) => (
        <Skeleton
          key={i}
          height="h-3"
          width={i === safe - 1 ? "w-2/3" : "w-full"}
        />
      ))}
    </div>
  );
}

/** Card-shaped skeleton: title + 3-line body inside a bordered container. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white dark:bg-zinc-800 p-4 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 space-y-3",
        className,
      )}
    >
      <Skeleton height="h-5" width="w-1/2" />
      <SkeletonText lines={3} />
    </div>
  );
}

export interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

/** Table skeleton with a header row + N body rows × M columns. */
export function SkeletonTable({ rows = 5, cols = 4, className }: SkeletonTableProps) {
  const safeRows = Math.max(1, rows);
  const safeCols = Math.max(1, cols);
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden",
        className,
      )}
    >
      {/* Header row */}
      <div
        className="grid gap-3 px-4 py-3 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-700"
        style={{ gridTemplateColumns: `repeat(${safeCols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: safeCols }).map((_, i) => (
          <Skeleton key={i} height="h-3" width="w-20" />
        ))}
      </div>
      {/* Body rows */}
      <div className="divide-y divide-slate-100 dark:divide-zinc-800">
        {Array.from({ length: safeRows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-3 px-4 py-3.5"
            style={{ gridTemplateColumns: `repeat(${safeCols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: safeCols }).map((_, c) => (
              <Skeleton
                key={c}
                height="h-3"
                // First column reads like an identifier (wider), last column
                // like a trailing action/timestamp (narrower) — matches the
                // typical table rhythm without being too uniform.
                width={c === 0 ? "w-3/4" : c === safeCols - 1 ? "w-1/2" : "w-2/3"}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Product-specific skeletons                                         */
/* ------------------------------------------------------------------ */

/**
 * Matches the shape of `ApplicationCard` rendered by `ApplicationQueue`
 * on `/applications`:
 *   [checkbox] [title + source badge + status badge + company + meta]
 *              [action button row]
 * Uses the same Card padding (`px-3 sm:px-6` + `pt-3 sm:pt-6` + `pb-3 sm:pb-6`)
 * so the loading state doesn't shift when the real card mounts.
 */
export function ApplicationCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 shadow-sm">
      {/* CardHeader — flex-row with checkbox + content column */}
      <div className="flex flex-row items-start gap-2 sm:gap-3 px-3 sm:px-6 pt-3 sm:pt-6 pb-2">
        {/* Checkbox stand-in */}
        <Skeleton height="h-4" width="w-4" className="mt-0.5 shrink-0 rounded" />
        <div className="flex-1 min-w-0 space-y-1">
          {/* Title line — h-4 to match font-semibold text-sm */}
          <Skeleton height="h-4" width="w-3/4" />
          {/* Source badge + status badge row */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Skeleton height="h-4" width="w-14" className="rounded-full" />
            <Skeleton height="h-4" width="w-16" className="rounded-full" />
          </div>
          {/* Company line */}
          <Skeleton height="h-3" width="w-1/2" className="mt-1" />
          {/* Meta line — recipient + match + resume + relative time */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
            <Skeleton height="h-3" width="w-32" />
            <Skeleton height="h-3" width="w-16" />
            <Skeleton height="h-3" width="w-20" />
            <Skeleton height="h-3" width="w-14" />
          </div>
        </div>
      </div>
      {/* CardContent — action button row */}
      <div className="px-3 sm:px-6 pb-3 sm:pb-6 pt-0">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Skeleton height="h-8" width="w-32" className="rounded-md" />
          <Skeleton height="h-8" width="w-24" className="rounded-md" />
          <Skeleton height="h-8" width="w-20" className="rounded-md" />
          <Skeleton height="h-8" width="w-24" className="rounded-md" />
          <Skeleton height="h-8" width="w-16" className="rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Matches the shape of `JobCard` on `/recommended` (and the grid item on
 * `/jobs`). Structure mirrors the real card:
 *   header (company • atsBadge • score%)
 *   title (2 lines)
 *   badges row (platform • status • remote • freshness • email)
 *   score progress bar + reason line
 *   salary line
 *   skill chips row
 *   location line
 *   action row separated by a top border
 *   prep row
 *
 * Padding (`p-3 sm:p-4`), rounded-xl, ring-1 and shadow-sm match the
 * production card so swap-in is zero-layout-shift.
 */
export function JobCardSkeleton() {
  return (
    <div className="group block rounded-xl bg-white dark:bg-zinc-800 p-3 sm:p-4 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60">
      {/* Header: company + score */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Skeleton height="h-3" width="w-3" className="rounded-sm" />
          <Skeleton height="h-3" width="w-24" />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Skeleton height="h-4" width="w-10" className="rounded" />
          <Skeleton height="h-4" width="w-10" />
        </div>
      </div>
      {/* Title — 2 lines tight */}
      <div className="space-y-1 mb-1.5">
        <Skeleton height="h-3.5" width="w-full" />
        <Skeleton height="h-3.5" width="w-4/5" />
      </div>
      {/* Badges row — platform + status + remote + freshness + email */}
      <div className="flex flex-wrap items-center gap-1 mb-1.5">
        <Skeleton height="h-4" width="w-14" className="rounded" />
        <Skeleton height="h-4" width="w-12" className="rounded" />
        <Skeleton height="h-4" width="w-14" className="rounded" />
        <Skeleton height="h-4" width="w-10" className="rounded" />
        <Skeleton height="h-4" width="w-12" className="rounded" />
      </div>
      {/* Score bar */}
      <div className="mb-1.5">
        <Skeleton height="h-1" width="w-full" className="rounded-full" />
        <Skeleton height="h-2.5" width="w-2/3" className="mt-1" />
      </div>
      {/* Salary line */}
      <Skeleton height="h-3" width="w-24" className="mb-1.5" />
      {/* Skills chips */}
      <div className="flex flex-wrap gap-1 mb-1.5">
        <Skeleton height="h-4" width="w-12" className="rounded" />
        <Skeleton height="h-4" width="w-14" className="rounded" />
        <Skeleton height="h-4" width="w-10" className="rounded" />
      </div>
      {/* Location */}
      <div className="flex items-center gap-1 mb-2">
        <Skeleton height="h-3" width="w-3" className="rounded-sm" />
        <Skeleton height="h-3" width="w-28" />
      </div>
      {/* Action row */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-50 dark:border-zinc-700/50">
        <Skeleton height="h-7" width="w-24" className="flex-1 sm:flex-initial rounded-lg" />
        <Skeleton height="h-7" width="w-20" className="flex-1 sm:flex-initial rounded-lg" />
        <Skeleton height="h-7" width="w-7" className="rounded-lg shrink-0" />
        <Skeleton height="h-7" width="w-7" className="rounded-lg shrink-0" />
        <Skeleton height="h-7" width="w-7" className="rounded-lg shrink-0" />
      </div>
      {/* Prep row */}
      <div className="mt-1.5 flex items-center gap-2">
        <Skeleton height="h-2.5" width="w-8" />
        <Skeleton height="h-2.5" width="w-16" />
        <Skeleton height="h-2.5" width="w-16" />
      </div>
    </div>
  );
}

/**
 * Matches the resume PDF preview block on `/resumes/tailor` once a
 * successful render lands. The real block is:
 *   (optional amber profile-source notice)
 *   bordered iframe wrapper — `h-[500px] w-full` with `rounded-xl`
 *   action button row (Download / Try again / History)
 *   coverage panel
 *
 * We render the same iframe-sized rectangle + the action row + a coverage-
 * panel stand-in so the page height is stable while the PDF stream lands.
 */
export function ResumePreviewSkeleton() {
  return (
    <div className="space-y-3">
      {/* Iframe-sized preview rectangle — h-[500px] matches the real iframe */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
        <Skeleton height="500px" width="w-full" className="rounded-none" />
      </div>
      {/* Action button row — Download (flex-1) / Try again / History */}
      <div className="flex gap-2">
        <Skeleton height="h-9" width="w-full" className="flex-1 rounded-md" />
        <Skeleton height="h-9" width="w-28" className="rounded-md" />
        <Skeleton height="h-9" width="w-28" className="rounded-md" />
      </div>
      {/* CoveragePanel stand-in — keyword coverage card */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-700 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton height="h-4" width="w-32" />
          <Skeleton height="h-4" width="w-16" />
        </div>
        <Skeleton height="h-2" width="w-full" className="rounded-full" />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height="h-5" width="w-16" className="rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
