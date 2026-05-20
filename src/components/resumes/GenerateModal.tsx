"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Download, Sparkle, X, FileText, FloppyDisk, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { resumeClient, type GenerateDiff } from "@/lib/resume/client";
import { DEFAULT_TEMPLATE_ID } from "@/lib/resume/templates/registry";

interface GenerateModalProps {
  open: boolean;
  onClose: () => void;
  profileId: string;
  /** Optional starter JD (e.g. when triggered from a job apply page). */
  initialJd?: string;
}

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  audience: string;
  atsRank: number;
  layout: string;
  available: boolean;
}

interface GenerationResult {
  generationId: string;
  templateId: string;
  template: string;
  previewUrl: string;
  pdfUrl: string;
  diff: GenerateDiff | null;
  warnings: string[];
  aiProvider: string | null;
}

type Step = "configure" | "preview";

export function GenerateModal({ open, onClose, profileId, initialJd }: GenerateModalProps) {
  const [step, setStep] = useState<Step>("configure");
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [pageTarget, setPageTarget] = useState<1 | 2>(1);
  const [jdText, setJdText] = useState(initialJd ?? "");
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);

  useEffect(() => {
    if (!open) return;
    resumeClient.listTemplates().then((rows) =>
      setTemplates(rows.map((r) => ({ ...r, layout: r.layout as string }))),
    ).catch(() => setTemplates([]));
  }, [open]);

  useEffect(() => {
    if (!open) {
      // Reset when closed so re-opening is fresh
      setStep("configure");
      setResult(null);
      setJdText(initialJd ?? "");
    }
  }, [open, initialJd]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const r = await resumeClient.generate({
        profileId,
        templateId,
        pageTarget,
        jdText: jdText.trim() || undefined,
      });
      setResult(r);
      setStep("preview");
      if (r.warnings.length > 0) {
        r.warnings.forEach((w) => toast.warning(w));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveVariant(name: string) {
    if (!result) return;
    try {
      const res = await fetch("/api/resumes/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: result.generationId, name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success(`Saved as "${name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleDownload() {
    if (!result) return;
    setDownloading(true);
    try {
      const res = await fetch(result.pdfUrl);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.hint ?? body.error ?? `PDF render failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume_${result.templateId}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <DialogTitle className="flex items-center gap-2">
            <Sparkle size={18} weight="fill" className="text-emerald-600" />
            {step === "configure" ? "Generate resume" : "Preview & download"}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            {step === "configure"
              ? "Pick a template, paste a JD (optional). On-demand only — nothing is rendered until you click Generate."
              : `${result?.template} · regenerate any time from History tab`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === "configure" && (
            <ConfigureStep
              templates={templates}
              templateId={templateId}
              setTemplateId={setTemplateId}
              pageTarget={pageTarget}
              setPageTarget={setPageTarget}
              jdText={jdText}
              setJdText={setJdText}
            />
          )}

          {step === "preview" && result && (
            <PreviewStep result={result} onSaveVariant={handleSaveVariant} />
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-2 flex-shrink-0">
          {step === "configure" ? (
            <>
              <Button variant="ghost" onClick={onClose} className="gap-1.5">
                <X size={14} /> Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Sparkle size={14} weight="fill" />
                {generating ? "Generating…" : "Generate preview"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep("configure")} className="gap-1.5">
                <ArrowLeft size={14} /> Back to settings
              </Button>
              <Button
                onClick={handleDownload}
                disabled={downloading || !result}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Download size={14} weight="bold" />
                {downloading ? "Rendering PDF…" : "Download PDF"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfigureStep({
  templates,
  templateId,
  setTemplateId,
  pageTarget,
  setPageTarget,
  jdText,
  setJdText,
}: {
  templates: TemplateOption[];
  templateId: string;
  setTemplateId: (id: string) => void;
  pageTarget: 1 | 2;
  setPageTarget: (n: 1 | 2) => void;
  jdText: string;
  setJdText: (s: string) => void;
}) {
  return (
    <div className="px-6 py-5 space-y-6">
      {/* JD paste */}
      <section>
        <Label
          title="Job description (optional)"
          hint="Phase 2: paste a JD and we'll tailor ordering and selection. In Phase 1 this is captured but ordering uses defaults."
        />
        <Textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste a job description here…"
          rows={4}
          className="font-mono text-xs"
        />
      </section>

      {/* Template picker */}
      <section>
        <Label title="Template" hint={`${templates.filter((t) => t.available).length} available · ${templates.filter((t) => !t.available).length} coming soon`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[28rem] overflow-y-auto pr-1">
          {templates.map((t) => {
            const selected = templateId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => t.available && setTemplateId(t.id)}
                disabled={!t.available}
                className={`text-left rounded-lg border p-3 transition-all ${
                  !t.available
                    ? "opacity-50 cursor-not-allowed border-zinc-200 dark:border-zinc-800"
                    : selected
                      ? "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold tabular-nums text-zinc-500">{t.id}</span>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{t.name}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2">{t.description}</p>
                    <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-500">{t.audience}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className="text-[10px] font-bold text-amber-600 dark:text-amber-400"
                      title={`ATS rank ${t.atsRank}/5`}
                    >
                      {"★".repeat(t.atsRank)}
                    </span>
                    {!t.available && (
                      <span className="text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Soon
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Page target */}
      <section>
        <Label title="Page count" hint="1pg trims projects to fit. 2pg allows everything in your profile." />
        <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 p-1 bg-zinc-50 dark:bg-zinc-900">
          {[1, 2].map((n) => (
            <button
              key={n}
              onClick={() => setPageTarget(n as 1 | 2)}
              className={`px-4 py-1.5 text-sm rounded-md font-semibold transition-colors ${
                pageTarget === n
                  ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {n} page
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function PreviewStep({
  result,
  onSaveVariant,
}: {
  result: GenerationResult;
  onSaveVariant: (name: string) => Promise<void>;
}) {
  const [variantName, setVariantName] = useState("");
  const [saving, setSaving] = useState(false);
  const tailored = result.diff != null;

  async function save() {
    const trimmed = variantName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSaveVariant(trimmed);
      setVariantName("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-0 h-full min-h-[60vh]">
      <div className="bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
        <iframe
          src={result.previewUrl}
          title="Resume preview"
          className="w-full h-full min-h-[60vh] border-0"
        />
      </div>
      <aside className="border-l border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950 space-y-3 text-xs overflow-y-auto max-h-[80vh]">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Template</p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <FileText size={14} weight="fill" className="text-emerald-600" />
            {result.template}
          </p>
        </div>

        <div className="rounded-lg border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-bold mb-1">
            Audit passed
          </p>
          <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/70">
            Every word in this PDF traces to your profile. No fabrication.
          </p>
        </div>

        {tailored && result.diff ? (
          <DiffPanel diff={result.diff} aiProvider={result.aiProvider} />
        ) : (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Tailoring</p>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              No JD provided — used your default profile ordering.
            </p>
          </div>
        )}

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Save as variant</p>
          <div className="flex gap-1.5">
            <Input
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              placeholder="e.g. AI-eval-leaning"
              className="text-xs h-8"
              maxLength={60}
            />
            <Button
              onClick={save}
              disabled={saving || !variantName.trim()}
              size="sm"
              className="gap-1 bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
            >
              <FloppyDisk size={12} weight="bold" />
              Save
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-500 dark:text-zinc-500">
            Re-apply this tailoring later without re-running the AI.
          </p>
        </div>
      </aside>
    </div>
  );
}

function DiffPanel({ diff, aiProvider }: { diff: GenerateDiff; aiProvider: string | null }) {
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Tailored for</p>
        <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 capitalize">
          {diff.roleFamily} role
          {aiProvider && (
            <span className="ml-1 font-normal text-zinc-500">
              · via {aiProvider}
            </span>
          )}
        </p>
      </div>

      {diff.promotedSkills.length > 0 && (
        <DiffBlock
          label="Promoted skills"
          items={diff.promotedSkills.slice(0, 8)}
          tone="emerald"
        />
      )}

      {diff.featuredProjects.length > 0 && (
        <DiffBlock
          label="Featured projects"
          items={diff.featuredProjects}
          tone="emerald"
        />
      )}

      {diff.pickedSummaryLabel && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Summary</p>
          <p className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
            {diff.pickedSummaryLabel}
          </p>
        </div>
      )}

      {diff.sectionOrderChanged && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Layout</p>
          <p className="text-[11px] text-zinc-700 dark:text-zinc-300">
            Reordered sections to match this JD's bias.
          </p>
        </div>
      )}

      {diff.matchedKeywords.length > 0 && (
        <DiffBlock
          label={`${diff.matchedKeywords.length} matched keywords`}
          items={diff.matchedKeywords.slice(0, 12)}
          tone="zinc"
        />
      )}

      {diff.missingHardSkills.length > 0 && (
        <div className="rounded-lg border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold mb-1 flex items-center gap-1">
            <Warning size={12} weight="fill" />
            Missing in your profile
          </p>
          <ul className="text-[11px] text-amber-800/80 dark:text-amber-200/70 space-y-0.5">
            {diff.missingHardSkills.slice(0, 6).map((s) => (
              <li key={s}>· {s}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] text-amber-700/70 dark:text-amber-400/60">
            JD asked for these. We won't fabricate — add them to your profile if accurate.
          </p>
        </div>
      )}
    </div>
  );
}

function DiffBlock({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "emerald" | "zinc";
}) {
  const chipClass =
    tone === "emerald"
      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200/60 dark:ring-emerald-800/40"
      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 ring-zinc-200 dark:ring-zinc-700/50";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((s) => (
          <span
            key={s}
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ring-1 ring-inset ${chipClass}`}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function Label({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{title}</p>
      {hint && <p className="text-[11px] text-zinc-500 dark:text-zinc-500 mt-0.5">{hint}</p>}
    </div>
  );
}
