"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download, Sparkles, X, FileText, Save, AlertTriangle, Search, Eye } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { resumeClient, type GenerateDiff } from "@/lib/resume/client";
import { DEFAULT_TEMPLATE_ID } from "@/lib/resume/templates/registry";
import type { RecommendExistingResumeResult } from "@/lib/resume/types";
import { RewriteDiff, type RewriteSummary } from "./RewriteDiff";

interface GenerateModalProps {
  open: boolean;
  onClose: () => void;
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
  rewrite?: RewriteSummary;
}

type Step = "configure" | "preview";

export function GenerateModal({ open, onClose, initialJd }: GenerateModalProps) {
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
        throw new Error(body.error ?? "We couldn't save that variant. Try again.");
      }
      toast.success(`Saved as "${name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't save that variant. Try again.");
    }
  }

  async function handleDownload() {
    if (!result) return;
    setDownloading(true);
    try {
      const res = await fetch(result.pdfUrl);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.hint ?? body.error ?? "The PDF didn't come out right. Try generating again — sometimes a different template helps.",
        );
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
            <Sparkles size={18} className="text-emerald-600" />
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
                <Sparkles size={14} />
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
                <Download size={14} />
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
          hint="Paste a JD and we'll reorder your skills, pick top projects by stack overlap, and choose your best summary. Bullets stay verbatim."
        />
        <Textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste a job description here…"
          rows={4}
          className="font-mono text-xs"
        />
        <RecommendExisting jdText={jdText} />
      </section>

      {/* Template picker — visual gallery with full-size preview lightbox per template. */}
      <section>
        <Label title="Template" hint={`${templates.filter((t) => t.available).length} available · ${templates.filter((t) => !t.available).length} coming soon`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[28rem] overflow-y-auto pr-1">
          {templates.map((t) => {
            const selected = templateId === t.id;
            return (
              <div
                key={t.id}
                className={`group rounded-xl border p-3 transition-all ${
                  !t.available
                    ? "opacity-50 border-zinc-200 dark:border-zinc-800"
                    : selected
                      ? "border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm"
                }`}
              >
                <button
                  onClick={() => t.available && setTemplateId(t.id)}
                  disabled={!t.available}
                  className="w-full flex gap-3 text-left disabled:cursor-not-allowed"
                >
                  <TemplateThumbnail templateId={t.id} layout={t.layout} available={t.available} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold tabular-nums text-zinc-400 dark:text-zinc-500">{t.id}</span>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{t.name}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2">{t.description}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-500 truncate">{t.audience}</p>
                      <span
                        className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0"
                        title={`ATS rank ${t.atsRank}/5`}
                      >
                        {"★".repeat(t.atsRank)}
                      </span>
                    </div>
                    {!t.available && (
                      <span className="mt-1 inline-block text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Soon
                      </span>
                    )}
                    {selected && t.available && (
                      <span className="mt-1 inline-block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                        ✓ Selected
                      </span>
                    )}
                  </div>
                </button>
                {t.available && (
                  <TemplatePreviewLightbox templateId={t.id} templateName={t.name} />
                )}
              </div>
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
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
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
      <aside className="border-l border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900 space-y-3 text-xs overflow-y-auto max-h-[80vh]">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Template</p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <FileText size={14} className="text-emerald-600" />
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

        {result.rewrite?.enabled ? (
          <div className="-mx-1">
            <RewriteDiff rewrite={result.rewrite} />
          </div>
        ) : null}

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
              <Save size={12} />
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
            <AlertTriangle size={12} />
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

/**
 * Recommend-existing — Phase 4 surface.
 * When user pastes a JD ≥ 80 chars, ping /api/resumes/recommend-existing
 * with light debounce. Shows the best-fit existing uploaded PDF + reasoning,
 * for the user who prefers attaching one of their 8 PDFs over generating fresh.
 */
function RecommendExisting({ jdText }: { jdText: string }) {
  const [result, setResult] = useState<RecommendExistingResumeResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = jdText.trim();
    if (trimmed.length < 80) {
      setResult(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await resumeClient.recommendExisting({ jdText: trimmed });
        setResult(r);
      } catch {
        setResult(null);
      } finally {
        setLoading(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [jdText]);

  if (!result || result.candidates.length === 0) return null;
  const top = result.candidates[0];
  if (top.score <= 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 p-3">
      <div className="flex items-start gap-2.5">
        <Search size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
            Or use an existing upload
            {loading && <span className="ml-1.5 text-zinc-500 font-normal">scanning…</span>}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-800/80 dark:text-amber-200/80">
            <strong>{top.resumeName}</strong> — {top.reason}
          </p>
          {top.matchedSkills.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {top.matchedSkills.slice(0, 6).map((s) => (
                <span
                  key={s}
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 ring-1 ring-amber-200/50 dark:ring-amber-800/30"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-[10px] text-amber-700/60 dark:text-amber-400/60">
            Tailored generation below is recommended — it picks your projects per JD.
            This option is for when you'd rather attach a static PDF.
          </p>
        </div>
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

// ─────────────────────────────────────────────────────────────────────
// TemplateThumbnail — renders the baked PNG for `available: true` templates
// (built via `scripts/build-template-thumbnails.ts` → public/templates/thumbnails/).
// Falls back to an abstract CSS wireframe for "coming soon" templates that
// don't have a baked thumbnail yet. The Set used to be hardcoded — now we
// gate on the `available` flag passed in from the registry so flipping one
// template auto-promotes it to a real PNG.
// ─────────────────────────────────────────────────────────────────────

// "Preview at full size" lightbox — shows the static John-Doe-rendered template
// PNG at large size so users can read the template character before generating
// their own resume. Theme: emerald (matches project, not purple).
function TemplatePreviewLightbox({ templateId, templateName }: { templateId: string; templateName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline"
      >
        <Eye size={11} />
        Preview full size
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <DialogTitle className="text-sm">{templateId} · {templateName} — sample preview</DialogTitle>
            <DialogDescription className="text-[11px]">
              Rendered with a fixture profile. Your own data will replace it when you generate.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 max-h-[75vh] overflow-y-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/templates/thumbnails/${templateId}.png`}
              alt={`${templateName} sample`}
              className="w-full h-auto rounded-md shadow-md border border-zinc-200 dark:border-zinc-700 bg-white"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TemplateThumbnail({ templateId, layout, available }: { templateId: string; layout: string; available: boolean }) {
  if (available) {
    return (
      <div className="shrink-0 w-[110px] aspect-[3/4] rounded-md bg-white shadow-sm border border-zinc-200 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/templates/thumbnails/${templateId}.png`}
          alt=""
          className="w-full h-full object-cover object-top"
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback wireframe for "coming soon" templates
  const isTwoCol = layout === "two-column";
  return (
    <div className="shrink-0 w-[68px] aspect-[3/4] rounded-md bg-white dark:bg-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-300 p-1.5 overflow-hidden">
      {isTwoCol ? (
        <div className="flex gap-1 h-full">
          <div className="w-1/3 bg-zinc-100 rounded-sm p-1 space-y-1">
            <div className="h-1 bg-zinc-400 rounded-full" />
            <div className="h-px bg-zinc-300 rounded-full" />
            <div className="h-px bg-zinc-300 rounded-full w-3/4" />
          </div>
          <div className="flex-1 space-y-[2px]">
            <div className="h-2 bg-zinc-800 rounded-sm w-3/4" />
            <div className="h-px bg-zinc-300 w-full" />
            <div className="h-px bg-zinc-300 w-5/6" />
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col">
          <div className="h-2 bg-zinc-800 rounded-sm w-2/3 mb-[2px]" />
          <div className="h-px bg-zinc-300 rounded-full w-full mb-1.5" />
          <div className="h-1 bg-zinc-600 rounded-sm w-1/3 mb-[1px]" />
          <div className="space-y-[3px] mb-1.5">
            <div className="h-px bg-zinc-300 rounded-full w-full" />
            <div className="h-px bg-zinc-300 rounded-full w-5/6" />
            <div className="h-px bg-zinc-300 rounded-full w-11/12" />
          </div>
          <div className="h-1 bg-zinc-600 rounded-sm w-2/5 mb-[1px]" />
          <div className="space-y-[3px]">
            <div className="h-px bg-zinc-300 rounded-full w-full" />
            <div className="h-px bg-zinc-300 rounded-full w-4/5" />
            <div className="h-px bg-zinc-300 rounded-full w-11/12" />
          </div>
        </div>
      )}
    </div>
  );
}
