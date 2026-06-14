"use client";

/**
 * Per-bullet "before / after" diff for the resume rewriter (Agent 4).
 *
 * Mounts inside the GenerateModal preview step after a successful rewrite
 * run. Receives the `rewrite` block from the /api/resumes/generate
 * response and renders:
 *   - A trust strip: "Rewritten in JD voice — audit passed | X bullets
 *     rephrased, Y skill labels mapped, summary kept original."
 *   - One row per rewritten bullet with original ↔ rewritten side-by-side.
 *   - A "revert this bullet" affordance per row (state only — the actual
 *     revert ships when the generation re-render endpoint lands).
 *
 * Aesthetic: warm stone, soft borders, no clinical blue. Matches tokens.css.
 */

import * as React from "react";
import { Check, RotateCcw, Sparkles, ShieldCheck } from "lucide-react";

export interface RewriteSummary {
  enabled: boolean;
  bulletsRewritten?: number;
  summaryRewritten?: boolean;
  skillsRelabeled?: number;
  auditPassed?: boolean;
  bulletDiff?: Record<string, string>;
  skillRelabels?: Record<string, string>;
}

interface Props {
  rewrite: RewriteSummary;
}

export function RewriteDiff({ rewrite }: Props) {
  const [reverted, setReverted] = React.useState<Set<string>>(() => new Set());

  if (!rewrite.enabled) return null;

  const bulletEntries = Object.entries(rewrite.bulletDiff ?? {});
  const skillEntries = Object.entries(rewrite.skillRelabels ?? {});

  const toggleRevert = (original: string) => {
    setReverted((prev) => {
      const next = new Set(prev);
      if (next.has(original)) next.delete(original);
      else next.add(original);
      return next;
    });
  };

  return (
    <section
      aria-label="Rewriter changes"
      className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4 sm:p-5 shadow-soft-sm"
    >
      <header className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="flex-1">
          <h3 className="text-[15px] font-medium text-stone-900">
            Rewritten in the JD's voice
          </h3>
          <p className="mt-0.5 text-[13px] leading-relaxed text-stone-600">
            {rewrite.bulletsRewritten ?? 0} bullet{(rewrite.bulletsRewritten ?? 0) === 1 ? "" : "s"} rephrased
            {rewrite.summaryRewritten ? ", summary updated" : ""}
            {(rewrite.skillsRelabeled ?? 0) > 0 ? `, ${rewrite.skillsRelabeled} skill label${rewrite.skillsRelabeled === 1 ? "" : "s"} aligned` : ""}.
            Every change is audited against your profile — no new facts.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            rewrite.auditPassed
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
          title={rewrite.auditPassed ? "Anti-fabrication audit passed" : "Audit flagged warnings — review before sending"}
        >
          <ShieldCheck className="size-3" aria-hidden />
          {rewrite.auditPassed ? "Audit passed" : "Review needed"}
        </span>
      </header>

      {skillEntries.length > 0 ? (
        <div className="mb-4 rounded-xl border border-stone-200/80 bg-white p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-stone-400">
            Skill labels aligned to the JD
          </p>
          <ul className="flex flex-wrap gap-2">
            {skillEntries.map(([from, to]) => (
              <li
                key={from}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[12px] text-stone-700"
              >
                <span className="text-stone-400 line-through">{from}</span>
                <span aria-hidden>→</span>
                <span className="font-medium text-stone-900">{to}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {bulletEntries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-white px-4 py-6 text-center text-[13px] text-stone-500">
          No bullets needed rephrasing — the originals already speak the JD's vocabulary.
        </p>
      ) : (
        <ul className="space-y-3">
          {bulletEntries.map(([original, rewritten]) => {
            const isReverted = reverted.has(original);
            return (
              <li
                key={original}
                className="overflow-hidden rounded-xl border border-stone-200/80 bg-white"
              >
                <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-stone-200/80">
                  <div className="p-3">
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-stone-400">
                      Original
                    </p>
                    <p className={`text-[13px] leading-relaxed ${isReverted ? "text-stone-900 font-medium" : "text-stone-500"}`}>
                      {original}
                    </p>
                  </div>
                  <div className={`p-3 ${isReverted ? "bg-stone-50" : "bg-emerald-50/40"}`}>
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700">
                      Rewritten
                    </p>
                    <p className={`text-[13px] leading-relaxed ${isReverted ? "text-stone-400 line-through" : "text-stone-900"}`}>
                      {rewritten}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end border-t border-stone-200/80 bg-stone-50/40 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleRevert(original)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 transition-colors duration-200 hover:bg-stone-100 hover:text-stone-900"
                  >
                    {isReverted ? (
                      <>
                        <Check className="size-3" aria-hidden />
                        Reverted — using original
                      </>
                    ) : (
                      <>
                        <RotateCcw className="size-3" aria-hidden />
                        Revert this bullet
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
