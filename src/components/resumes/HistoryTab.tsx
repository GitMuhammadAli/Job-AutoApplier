"use client";

import { useEffect, useState } from "react";
import { Clock, Download, Eye, FileText } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface GenerationRow {
  id: string;
  templateId: string;
  templateVersion: string;
  pageTarget: number;
  jdSnippet: string | null;
  createdAt: string;
}

export function HistoryTab() {
  const [rows, setRows] = useState<GenerationRow[] | undefined>(undefined);

  useEffect(() => {
    fetch("/api/resumes/generations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { generations: [] }))
      .then((d) => setRows(d.generations ?? []))
      .catch(() => setRows([]));
  }, []);

  if (rows === undefined) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-500">
        Loading history…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
          <Clock size={20} className="text-zinc-500" />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
          No generations yet
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Click "Generate resume" once your profile is set up. Every render is logged here for re-download.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 shrink-0">
            <FileText size={14} weight="fill" className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              {r.templateId}
              <span className="ml-2 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500 font-normal">
                {r.pageTarget}-page · {r.templateVersion}
              </span>
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
              {new Date(r.createdAt).toLocaleString()}
              {r.jdSnippet ? " · JD pasted" : ""}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={`/api/resumes/generations/${r.id}/preview`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Eye size={12} /> Preview
            </a>
            <a
              href={`/api/resumes/generations/${r.id}/pdf`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
            >
              <Download size={12} weight="bold" /> PDF
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
