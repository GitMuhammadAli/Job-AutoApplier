"use client";

/**
 * "Source PDF" selector — explicit control over which uploaded resume the
 * AI uses as the truth-source when the structured profile is incomplete.
 *
 * Previously the parser walked the top 3 uploads silently and the user had
 * no idea which one ended up in their generated PDF. This makes it explicit:
 *   "AI used Resume-2024-Q4.pdf. Want it to use a different one? [picker]"
 *
 * Wires into /api/resumes/profile/parse-pdf?resumeId=... so re-parse is a
 * single click. Doesn't fire until the user actually picks something
 * different — no extra cost on the default path.
 *
 * Aesthetic: warm stone, ghost-style picker, soft border. Matches tokens.css.
 */

import * as React from "react";
import { FileText, Check, ChevronDown } from "lucide-react";

interface UploadOption {
  id: string;
  name: string;
  /** Higher = AI thinks it's a better parse source. */
  parseScore?: number;
  /** Human time, e.g. "Saved 3 days ago". */
  savedAt?: string;
}

interface Props {
  /** Filename of the upload the AI actually used. Null if structured profile won. */
  activeResumeName: string | null;
  /** All parseable uploads, ordered by AI ranking. */
  options: UploadOption[];
  /** Active upload id — must match one of `options[].id`. */
  activeId: string | null;
  /** Fires when user picks a different upload. Parent re-runs the parse. */
  onPick: (id: string) => void;
  /** True while a re-parse is in flight. */
  loading?: boolean;
}

export function SourcePdfSelector({
  activeResumeName,
  options,
  activeId,
  onPick,
  loading,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) {
      window.addEventListener("mousedown", onClickOutside);
      return () => window.removeEventListener("mousedown", onClickOutside);
    }
  }, [open]);

  if (!activeResumeName) {
    return (
      <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 px-4 py-3 text-[13px] text-stone-600">
        Using your saved profile as the truth-source.
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative rounded-xl border border-stone-200/80 bg-stone-50/60 p-3 sm:p-4 shadow-soft-sm"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-stone-500">
          <FileText className="size-4" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
            Truth source
          </p>
          <p className="mt-0.5 text-[14px] font-medium text-stone-900">
            {activeResumeName}
          </p>
          <p className="mt-0.5 text-[12px] text-stone-500">
            AI is building this resume from the content in this upload.
          </p>
        </div>
        {options.length > 1 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-stone-700 transition-colors duration-200 hover:bg-stone-100 disabled:opacity-50"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            {loading ? "Re-parsing…" : "Change"}
            <ChevronDown className="size-3" aria-hidden />
          </button>
        ) : null}
      </div>

      {open ? (
        <ul
          role="listbox"
          className="absolute right-3 top-full z-10 mt-1 w-full max-w-[20rem] overflow-hidden rounded-xl border border-stone-200/80 bg-white shadow-soft-lg"
        >
          {options.map((opt) => {
            const active = opt.id === activeId;
            return (
              <li key={opt.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (!active) onPick(opt.id);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-200 hover:bg-stone-50 ${
                    active ? "bg-stone-50" : ""
                  }`}
                >
                  <Check
                    className={`size-3.5 shrink-0 ${active ? "text-emerald-600" : "text-transparent"}`}
                    aria-hidden
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[13px] text-stone-900">{opt.name}</span>
                    {opt.savedAt ? (
                      <span className="block text-[11px] text-stone-400">{opt.savedAt}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
