"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Sparkles,
  XCircle,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { resumeClient, type GenerateCoverage, type GenerateDiff } from "@/lib/resume/client";
import { DEFAULT_TEMPLATE_ID } from "@/lib/resume/templates/registry";

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
  coverage: GenerateCoverage | null;
}

const MIN_JD_LEN = 20;

export function TailorClient({ initialJd }: { initialJd: string }) {
  const router = useRouter();
  const [jdText, setJdText] = useState(initialJd);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [pageTarget, setPageTarget] = useState<1 | 2>(1);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);

  useEffect(() => {
    resumeClient
      .listTemplates()
      .then((rows) => setTemplates(rows.map((r) => ({ ...r, layout: r.layout as string }))))
      .catch(() => setTemplates([]));
  }, []);

  const canGenerate = jdText.trim().length >= MIN_JD_LEN;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setResult(null);
    try {
      const r = await resumeClient.generate({
        templateId,
        pageTarget,
        jdText: jdText.trim(),
      });
      setResult(r);
      if (r.warnings.length > 0) {
        r.warnings.forEach((w) => toast.warning(w));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  }, [canGenerate, templateId, pageTarget, jdText]);

  const handleDownload = useCallback(async () => {
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
      a.download = `resume_${result.templateId}_${jobSlugFromJd(jdText)}.pdf`;
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
  }, [result, jdText]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
      {/* Left — inputs */}
      <section className="space-y-4">
        <JdInput jdText={jdText} setJdText={setJdText} />
        <TemplatePicker
          templates={templates}
          templateId={templateId}
          setTemplateId={setTemplateId}
        />
        <PageTarget value={pageTarget} setValue={setPageTarget} />

        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
            className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? "Tailoring…" : canGenerate ? "Tailor & preview" : `Paste a JD (${MIN_JD_LEN}+ chars)`}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/resumes">Back</Link>
          </Button>
        </div>
      </section>

      {/* Right — output */}
      <section className="space-y-4">
        {!result && !generating && (
          <EmptyPreview />
        )}
        {generating && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex items-center justify-center min-h-[400px]">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="animate-spin" size={16} />
              Tailoring your resume…
            </div>
          </div>
        )}
        {result && (
          <ResultPanel
            result={result}
            downloading={downloading}
            onDownload={handleDownload}
            onRegenerate={() => {
              setResult(null);
              router.refresh();
            }}
          />
        )}
      </section>
    </div>
  );
}

// ── JD textarea ────────────────────────────────────────────────────

function JdInput({ jdText, setJdText }: { jdText: string; setJdText: (s: string) => void }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Job description</p>
        <p className="text-[11px] text-zinc-500 tabular-nums">{jdText.length} chars</p>
      </div>
      <Textarea
        value={jdText}
        onChange={(e) => setJdText(e.target.value)}
        placeholder="Paste the full JD here. The more context, the better the match — keywords, requirements, even nice-to-haves."
        rows={10}
        className="font-mono text-xs"
      />
      <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-500">
        We'll extract keywords, find the ones you have in your profile, and force-include
        any project or skill the LLM would have dropped.
      </p>
    </div>
  );
}

// ── Template picker ────────────────────────────────────────────────

function TemplatePicker({
  templates,
  templateId,
  setTemplateId,
}: {
  templates: TemplateOption[];
  templateId: string;
  setTemplateId: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Template</p>
        <p className="text-[11px] text-zinc-500">
          {templates.filter((t) => t.available).length} available
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        {templates.map((t) => {
          const selected = templateId === t.id;
          return (
            <div
              key={t.id}
              className={`group rounded-lg border p-2 transition-all ${
                !t.available
                  ? "opacity-50 border-zinc-200 dark:border-zinc-800"
                  : selected
                    ? "border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <button
                onClick={() => t.available && setTemplateId(t.id)}
                disabled={!t.available}
                className="w-full flex gap-2 text-left disabled:cursor-not-allowed"
              >
                <div className="shrink-0 w-[60px] aspect-[3/4] rounded bg-white border border-zinc-200 overflow-hidden">
                  {t.available && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/templates/thumbnails/${t.id}.png`}
                      alt=""
                      className="w-full h-full object-cover object-top"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold tabular-nums text-zinc-400">{t.id}</span>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                      {t.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-tight">
                    {t.description}
                  </p>
                  <span
                    className="text-[9px] font-bold text-amber-600 dark:text-amber-400"
                    title={`ATS rank ${t.atsRank}/5`}
                  >
                    {"★".repeat(t.atsRank)}
                  </span>
                </div>
              </button>
              {t.available && <TemplatePreviewButton id={t.id} name={t.name} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TemplatePreviewButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline"
      >
        <Eye size={10} /> Preview
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader className="px-5 py-3 border-b">
            <DialogTitle className="text-sm">{id} — {name}</DialogTitle>
            <DialogDescription className="text-[11px]">
              Rendered with a fixture profile. Your data replaces it when you tailor.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 max-h-[75vh] overflow-y-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/templates/thumbnails/${id}.png`}
              alt={name}
              className="w-full h-auto rounded shadow border border-zinc-200 bg-white"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Page target ────────────────────────────────────────────────────

function PageTarget({ value, setValue }: { value: 1 | 2; setValue: (n: 1 | 2) => void }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Page count</p>
      <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 p-1 bg-zinc-50 dark:bg-zinc-900">
        {[1, 2].map((n) => (
          <button
            key={n}
            onClick={() => setValue(n as 1 | 2)}
            className={`px-4 py-1.5 text-sm rounded-md font-semibold transition-colors ${
              value === n
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {n} page
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        1pg keeps top 3 projects. 2pg fits everything you've authored.
      </p>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────

function EmptyPreview() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 flex flex-col items-center justify-center text-center min-h-[400px]">
      <Sparkles size={32} className="text-zinc-300 mb-3" />
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
        Paste a JD, click Tailor
      </p>
      <p className="text-[11px] text-zinc-500 max-w-xs">
        You'll see a JD-matched resume preview here, plus a coverage breakdown
        showing which keywords landed on the PDF.
      </p>
    </div>
  );
}

// ── Result panel ───────────────────────────────────────────────────

function ResultPanel({
  result,
  downloading,
  onDownload,
  onRegenerate,
}: {
  result: GenerationResult;
  downloading: boolean;
  onDownload: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
        <iframe src={result.previewUrl} title="Resume preview" className="w-full h-[500px] border-0" />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onDownload}
          disabled={downloading}
          className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {downloading ? "Rendering PDF…" : "Download PDF"}
        </Button>
        <Button onClick={onRegenerate} variant="outline" className="gap-2">
          <Sparkles size={14} /> Try again
        </Button>
      </div>

      {result.coverage && <CoveragePanel coverage={result.coverage} />}
    </div>
  );
}

// ── Coverage panel ─────────────────────────────────────────────────

function CoveragePanel({ coverage }: { coverage: GenerateCoverage }) {
  const total = coverage.covered.length + coverage.inProfileNotPicked.length + coverage.missing.length;
  const pct = Math.round(coverage.coverageRatio * 100);
  const renderedCount = coverage.covered.length + coverage.forcedProjects.length + coverage.forcedSkills.length;
  const renderedPct = total === 0 ? 0 : Math.round((renderedCount / total) * 100);
  const adjustedPct = Math.min(100, Math.max(pct, renderedPct));

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">ATS Keyword Coverage</p>
        <span
          className={`text-sm font-bold tabular-nums ${
            adjustedPct >= 80
              ? "text-emerald-600 dark:text-emerald-400"
              : adjustedPct >= 60
                ? "text-amber-600 dark:text-amber-400"
                : "text-red-600 dark:text-red-400"
          }`}
        >
          {adjustedPct}%
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${
            adjustedPct >= 80
              ? "bg-emerald-500"
              : adjustedPct >= 60
                ? "bg-amber-500"
                : "bg-red-500"
          }`}
          style={{ width: `${adjustedPct}%` }}
        />
      </div>

      {(coverage.forcedProjects.length > 0 || coverage.forcedSkills.length > 0) && (
        <div className="rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 px-2.5 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
          <strong>Force-included</strong> {coverage.forcedProjects.length} project(s)
          {coverage.forcedSkills.length > 0 && `, ${coverage.forcedSkills.length} skill(s)`} so JD
          keywords you have don't get dropped.
        </div>
      )}

      {coverage.lostFromForceInclude.length > 0 && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-2">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                Trade-off: force-include cost you {coverage.lostFromForceInclude.length} other keyword{coverage.lostFromForceInclude.length === 1 ? "" : "s"}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {coverage.lostFromForceInclude.slice(0, 8).map((kw) => (
                  <span
                    key={kw}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded ring-1 ring-inset bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 ring-amber-300/40"
                  >
                    {kw}
                  </span>
                ))}
                {coverage.lostFromForceInclude.length > 8 && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-300">
                    +{coverage.lostFromForceInclude.length - 8}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[10px] text-amber-700/80 dark:text-amber-300/80">
                These were landing before force-include pushed other projects past the 1-page cap.
                {coverage.pageBumpRecommended && (
                  <>
                    {" "}
                    Use 2 pages above (page count toggle) and regenerate to keep both groups.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {coverage.auditNotLanded.length > 0 && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-2">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                Claimed covered, but didn't land on the PDF
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {coverage.auditNotLanded.slice(0, 8).map((kw) => (
                  <span
                    key={kw}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded ring-1 ring-inset bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 ring-amber-300/40"
                  >
                    {kw}
                  </span>
                ))}
                {coverage.auditNotLanded.length > 8 && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-300">
                    +{coverage.auditNotLanded.length - 8}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[10px] text-amber-700/80 dark:text-amber-300/80">
                Template probably hid the section in 1-page mode. Try 2 pages
                or pick a different template.
              </p>
            </div>
          </div>
        </div>
      )}

      <KeywordList
        label={
          coverage.auditNotLanded.length > 0
            ? "Confirmed on your PDF (grep-verified)"
            : "On your PDF"
        }
        tone="ok"
        items={coverage.covered.filter(
          (kw) => !coverage.auditNotLanded.includes(kw),
        )}
      />
      {coverage.inProfileNotPicked.length > 0 && (
        <KeywordList
          label="In your profile but the LLM dropped them (we force-included)"
          tone="warn"
          items={coverage.inProfileNotPicked}
        />
      )}
      {coverage.missing.length > 0 && (
        <MissingKeywordsBlock
          missing={coverage.missing}
          adjacency={coverage.missingWithAdjacency}
        />
      )}
    </div>
  );
}

/**
 * Missing-keyword section with adjacency surfacing. For each missing
 * keyword we have adjacency data for, show a small "you have X" line
 * underneath so the user can decide whether to mention adjacent
 * experience. Keywords with no adjacency fall into a separate "no related
 * experience surfaced" group at the bottom.
 */
function MissingKeywordsBlock({
  missing,
  adjacency,
}: {
  missing: string[];
  adjacency: GenerateCoverage["missingWithAdjacency"];
}) {
  const adjacencyMap = new Map(adjacency.map((m) => [m.keyword.toLowerCase(), m]));
  const withAdj = missing.filter((kw) => adjacencyMap.has(kw.toLowerCase()));
  const withoutAdj = missing.filter((kw) => !adjacencyMap.has(kw.toLowerCase()));

  return (
    <div className="space-y-3">
      {withAdj.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
              Missing — but you have related experience{" "}
              <span className="tabular-nums">({withAdj.length})</span>
            </p>
          </div>
          <div className="space-y-2">
            {withAdj.map((kw) => {
              const adj = adjacencyMap.get(kw.toLowerCase())!;
              return (
                <div
                  key={kw}
                  className="rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 px-2.5 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                      JD wants {kw}
                    </span>
                    <span className="text-[10px] text-zinc-500">— you have:</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {adj.adjacentSkills.slice(0, 6).map((s) => (
                      <span
                        key={s}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded ring-1 ring-inset bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 ring-amber-300/40"
                      >
                        {s}
                      </span>
                    ))}
                    {adj.adjacentProjectIds.length > 0 && (
                      <span className="text-[10px] text-amber-700 dark:text-amber-300">
                        + {adj.adjacentProjectIds.length} project
                        {adj.adjacentProjectIds.length !== 1 ? "s" : ""} with related tech
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-amber-700/80 dark:text-amber-300/70">
                    Closest match in your profile. Worth mentioning if your work was
                    genuinely related — you decide.
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {withoutAdj.length > 0 && (
        <KeywordList
          label={
            withAdj.length > 0
              ? "Missing — no related experience surfaced"
              : "JD asks for these but you don't have them"
          }
          tone="bad"
          items={withoutAdj}
          hint="We won't fabricate. Add to your profile if accurate, or skip this job if the gap is too wide."
        />
      )}
    </div>
  );
}

function KeywordList({
  label,
  tone,
  items,
  hint,
}: {
  label: string;
  tone: "ok" | "warn" | "bad";
  items: string[];
  hint?: string;
}) {
  if (items.length === 0) return null;
  const colors = {
    ok: {
      icon: CheckCircle2,
      iconCls: "text-emerald-600 dark:text-emerald-400",
      chipCls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200/60 dark:ring-emerald-800/40",
    },
    warn: {
      icon: AlertTriangle,
      iconCls: "text-amber-600 dark:text-amber-400",
      chipCls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-amber-200/60 dark:ring-amber-800/40",
    },
    bad: {
      icon: XCircle,
      iconCls: "text-red-600 dark:text-red-400",
      chipCls: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-red-200/60 dark:ring-red-800/40",
    },
  } as const;
  const Icon = colors[tone].icon;
  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <Icon className={`h-3 w-3 ${colors[tone].iconCls}`} />
        <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
          {label} <span className="tabular-nums">({items.length})</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {items.slice(0, 24).map((kw) => (
          <span
            key={kw}
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ring-1 ring-inset ${colors[tone].chipCls}`}
          >
            {kw}
          </span>
        ))}
        {items.length > 24 && (
          <span className="text-[10px] text-zinc-500">+{items.length - 24}</span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-[10px] text-zinc-500">{hint}</p>}
    </div>
  );
}

// Tiny helper — pull a slug from the JD's first line for the PDF filename.
function jobSlugFromJd(jd: string): string {
  const head = jd.split(/\r?\n/)[0]?.trim() ?? "";
  const slug = head
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || `tailored-${Date.now()}`;
}
