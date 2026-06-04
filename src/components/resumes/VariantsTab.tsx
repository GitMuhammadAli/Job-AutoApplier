"use client";

import { useEffect, useState } from "react";
import { Sparkles, Trash2, ArrowRight, FileText, Download, Eye, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * VariantsTab — favorites view.
 *
 * After the schema flatten, ResumeVariant was dropped. "Saving a variant"
 * = naming a `ResumeGeneration` row and flagging `isFavorite=true`.
 * This tab lists all favorites (generations with `isFavorite=true`),
 * with rename + unfavorite + delete actions.
 */

interface GenerationRow {
  id: string;
  templateId: string;
  templateVersion: string;
  pageTarget: number;
  name: string | null;
  isFavorite: boolean;
  jdSnippet: string | null;
  createdAt: string;
}

export function VariantsTab() {
  const [rows, setRows] = useState<GenerationRow[] | undefined>(undefined);

  async function load() {
    try {
      const res = await fetch("/api/resumes/generations?favorites=1", { cache: "no-store" });
      const data = await res.json();
      setRows((data.generations ?? []).filter((g: GenerationRow) => g.isFavorite));
    } catch {
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUnfavorite(id: string) {
    try {
      const res = await fetch(`/api/resumes/generations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: false }),
      });
      if (!res.ok) throw new Error("We couldn't remove that from favorites. Try again.");
      toast.success("Removed from favorites.");
      setRows((curr) => (curr ? curr.filter((g) => g.id !== id) : curr));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't update that. Try again.");
    }
  }

  if (rows === undefined) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-500">
        Loading favorites…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 mb-4">
          <Star size={20} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">No favorite resumes yet</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
          Generate a resume, then star it from the preview to save it as a named variant
          (e.g. "AI-eval-leaning"). Favorites surface here for one-click re-download.
        </p>
        <p className="mt-4 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
          Open the History tab to find past generations to favorite
          <ArrowRight size={12} />
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((v) => (
        <li
          key={v.id}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 shrink-0">
            <FileText size={14} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              {v.name ?? `Generation ${v.id.slice(0, 6)}`}
              {v.jdSnippet && (
                <span className="text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 rounded px-1.5 py-0.5">
                  JD-tailored
                </span>
              )}
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
              {v.templateId} · {v.pageTarget}-page · saved {new Date(v.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={`/api/resumes/generations/${v.id}/preview`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Eye size={12} /> Preview
            </a>
            <a
              href={`/api/resumes/generations/${v.id}/pdf`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
            >
              <Download size={12} /> PDF
            </a>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleUnfavorite(v.id)}
            className="text-red-500 hover:text-red-600 gap-1.5"
          >
            <Trash2 size={12} /> Unfavorite
          </Button>
        </li>
      ))}
    </ul>
  );
}

// Sparkles import kept for backwards compat in case other code imports
void Sparkles;
