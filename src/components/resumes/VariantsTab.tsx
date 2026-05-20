"use client";

import { useEffect, useState } from "react";
import { Sparkle, Trash, ArrowRight, FileText, Download, Eye } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface VariantData {
  id: string;
  name: string;
  templateId: string;
  pageTarget: number;
  generatedFromJd: boolean;
  isDefault?: boolean;
  jdSnippet?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export function VariantsTab() {
  const [rows, setRows] = useState<VariantData[] | undefined>(undefined);

  async function load() {
    try {
      const res = await fetch("/api/resumes/variants", { cache: "no-store" });
      const data = await res.json();
      setRows(data.variants ?? []);
    } catch {
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/resumes/variants/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      toast.success("Variant deleted");
      setRows((curr) => (curr ? curr.filter((v) => v.id !== id) : curr));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (rows === undefined) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-500">
        Loading variants…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 mb-4">
          <Sparkle size={20} weight="fill" className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">No saved variants</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
          When you generate a JD-tailored resume, save it as a named variant
          to re-apply the same tailoring later without re-running the AI.
        </p>
        <p className="mt-4 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
          Generate one and click "Save as variant" in the preview
          <ArrowRight size={12} />
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((v) => (
        <VariantRow key={v.id} variant={v} onDelete={() => handleDelete(v.id)} />
      ))}
    </ul>
  );
}

interface VariantGeneration {
  generationId: string;
  templateId: string;
  pageTarget: number;
  createdAt: string;
  previewUrl: string;
  pdfUrl: string;
}

function VariantRow({
  variant,
  onDelete,
}: {
  variant: VariantData;
  onDelete: () => void;
}) {
  const [gen, setGen] = useState<VariantGeneration | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/resumes/variants/${variant.id}/generation`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setGen(d as VariantGeneration | null))
      .catch(() => setGen(null));
  }, [variant.id]);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 shrink-0">
        <FileText size={14} weight="fill" className="text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          {variant.name}
          {variant.generatedFromJd && (
            <span className="text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 rounded px-1.5 py-0.5">
              JD-tailored
            </span>
          )}
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
          {variant.templateId} · {variant.pageTarget}-page · saved{" "}
          {new Date(variant.updatedAt ?? variant.createdAt).toLocaleDateString()}
        </p>
      </div>

      {gen && (
        <div className="flex items-center gap-1">
          <a
            href={gen.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Eye size={12} /> Preview
          </a>
          <a
            href={gen.pdfUrl}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
          >
            <Download size={12} weight="bold" /> PDF
          </a>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="text-red-500 hover:text-red-600 gap-1.5"
      >
        <Trash size={12} /> Delete
      </Button>
    </li>
  );
}
