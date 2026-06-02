"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X, Save, ArrowLeft, Star, Sparkles, Loader2, Check, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { resumeClient } from "@/lib/resume/client";
import {
  ResumeProfileSchema,
  type ResumeProfile,
  type ResumeExperience,
  type ResumeProject,
  type ResumeEducation,
  type ResumeSummary,
  RESUME_LIMITS,
} from "@/lib/resume/types";
import { getSkillSuggestions, type SkillSuggestion } from "@/app/actions/skill-suggestions";

interface ProfileEditorProps {
  initialProfile: ResumeProfile;
  onCancel: () => void;
  onSave: (p: ResumeProfile) => void;
  /** When rendered inside the onboarding wizard, hide the duplicate sticky Back. */
  embedded?: boolean;
}

export function ProfileEditor({ initialProfile, onCancel, onSave, embedded = false }: ProfileEditorProps) {
  const [profile, setProfile] = useState<ResumeProfile>(initialProfile);
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");

  function update<K extends keyof ResumeProfile>(key: K, value: ResumeProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  async function handleSave() {
    const parsed = ResumeProfileSchema.safeParse(profile);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(`${first.path.join(".") || "profile"}: ${first.message}`);
      return;
    }
    setSaving(true);
    try {
      const saved = await resumeClient.saveProfile(parsed.data);
      toast.success("Profile saved");
      onSave(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addSkill() {
    const s = skillInput.trim();
    if (!s) return;
    if (profile.skills.some((existing) => existing.toLowerCase() === s.toLowerCase())) {
      setSkillInput("");
      return;
    }
    update("skills", [...profile.skills, s].slice(0, RESUME_LIMITS.MAX_SKILLS_TOTAL));
    setSkillInput("");
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-1 px-1 py-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
        {embedded ? (
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            Editing profile
          </span>
        ) : (
          <Button onClick={onCancel} variant="ghost" className="gap-1.5">
            <ArrowLeft size={14} /> Back
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Save size={14} />
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>

      {/* Header */}
      <SectionCard title="Header" subtitle="Top of every resume. Edits here propagate to all templates.">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Full name" required>
            <Input
              value={profile.header.fullName}
              onChange={(e) => update("header", { ...profile.header, fullName: e.target.value })}
              placeholder="Muhammad Ali Shahid"
            />
          </Field>
          <Field label="Headline" required>
            <Input
              value={profile.header.headline}
              onChange={(e) => update("header", { ...profile.header, headline: e.target.value })}
              placeholder="Software Engineer — Full Stack"
            />
          </Field>
          <Field label="Email" required>
            <Input
              type="email"
              value={profile.header.email}
              onChange={(e) => update("header", { ...profile.header, email: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={profile.header.phone ?? ""}
              onChange={(e) => update("header", { ...profile.header, phone: e.target.value || undefined })}
            />
          </Field>
          <Field label="Location">
            <Input
              value={profile.header.location ?? ""}
              onChange={(e) => update("header", { ...profile.header, location: e.target.value || undefined })}
              placeholder="Lahore, Pakistan"
            />
          </Field>
          <Field label="Website URL">
            <Input
              value={profile.header.websiteUrl ?? ""}
              onChange={(e) => update("header", { ...profile.header, websiteUrl: e.target.value || undefined })}
              placeholder="https://…"
            />
          </Field>
          <Field label="GitHub URL">
            <Input
              value={profile.header.githubUrl ?? ""}
              onChange={(e) => update("header", { ...profile.header, githubUrl: e.target.value || undefined })}
              placeholder="https://github.com/…"
            />
          </Field>
          <Field label="LinkedIn URL">
            <Input
              value={profile.header.linkedinUrl ?? ""}
              onChange={(e) => update("header", { ...profile.header, linkedinUrl: e.target.value || undefined })}
              placeholder="https://linkedin.com/in/…"
            />
          </Field>
        </div>
      </SectionCard>

      {/* Summaries */}
      <SectionCard
        title="Summaries"
        subtitle={`Write 1–${RESUME_LIMITS.MAX_SUMMARIES} variants. When you paste a JD, the AI picks the best fit — never writes new prose.`}
      >
        <div className="space-y-2.5">
          {profile.summaries.map((s, idx) => (
            <SummaryRow
              key={s.id ?? idx}
              summary={s}
              onChange={(updated) => {
                const next = [...profile.summaries];
                next[idx] = updated;
                update("summaries", next);
              }}
              onSetDefault={() => {
                update("summaries", profile.summaries.map((x, i) => ({ ...x, isDefault: i === idx })));
              }}
              onRemove={() => {
                update("summaries", profile.summaries.filter((_, i) => i !== idx));
              }}
            />
          ))}
          {profile.summaries.length < RESUME_LIMITS.MAX_SUMMARIES && (
            <Button
              variant="outline"
              className="w-full gap-1.5"
              onClick={() =>
                update("summaries", [
                  ...profile.summaries,
                  { label: `Variant ${profile.summaries.length + 1}`, content: "", isDefault: profile.summaries.length === 0 },
                ])
              }
            >
              <Plus size={14} /> Add summary variant
            </Button>
          )}
        </div>
      </SectionCard>

      {/* Skills */}
      <SectionCard
        title="Skills"
        subtitle="Your master list — JD tailoring can reorder these but cannot add new ones."
      >
        <div className="flex gap-2 mb-3">
          <Input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill();
              }
            }}
            placeholder="Type a skill, press Enter"
            className="flex-1"
          />
          <Button onClick={addSkill} disabled={!skillInput.trim()} className="gap-1.5">
            <Plus size={14} /> Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {profile.skills.map((s) => (
            <span
              key={s}
              className="group inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-200 dark:ring-zinc-700/50"
            >
              {s}
              <button
                onClick={() => update("skills", profile.skills.filter((x) => x !== s))}
                className="text-zinc-400 hover:text-red-500 transition-colors"
                aria-label={`Remove ${s}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {profile.skills.length === 0 && (
            <p className="text-xs text-zinc-500 italic">No skills yet — add a few to get started.</p>
          )}
        </div>

        <SkillSuggestions
          existingSkills={profile.skills}
          onAdd={(s) => {
            if (profile.skills.some((existing) => existing.toLowerCase() === s.toLowerCase())) return;
            update("skills", [...profile.skills, s].slice(0, RESUME_LIMITS.MAX_SKILLS_TOTAL));
          }}
        />
      </SectionCard>

      {/* Experiences */}
      <SectionCard
        title="Experience"
        subtitle="Job title, company, dates, bullets. AI may reorder bullets within a job, never rewrite them."
      >
        <div className="space-y-3">
          {profile.experiences.map((e, idx) => (
            <ExperienceRow
              key={e.id ?? idx}
              exp={e}
              userSkills={profile.skills}
              onChange={(updated) => {
                const next = [...profile.experiences];
                next[idx] = updated;
                update("experiences", next);
              }}
              onRemove={() => {
                update("experiences", profile.experiences.filter((_, i) => i !== idx));
              }}
            />
          ))}
          <Button
            variant="outline"
            className="w-full gap-1.5"
            onClick={() =>
              update("experiences", [
                ...profile.experiences,
                {
                  company: "",
                  title: "",
                  startDate: "",
                  bullets: [""],
                  order: profile.experiences.length,
                },
              ])
            }
          >
            <Plus size={14} /> Add experience
          </Button>
        </div>
      </SectionCard>

      {/* Projects */}
      <SectionCard
        title="Projects"
        subtitle="Star up to a handful as Featured — they're always included if the page has room."
      >
        <div className="space-y-3">
          {profile.projects.map((p, idx) => (
            <ProjectRow
              key={p.id ?? idx}
              project={p}
              userSkills={profile.skills}
              onChange={(updated) => {
                const next = [...profile.projects];
                next[idx] = updated;
                update("projects", next);
              }}
              onRemove={() => {
                update("projects", profile.projects.filter((_, i) => i !== idx));
              }}
            />
          ))}
          <Button
            variant="outline"
            className="w-full gap-1.5"
            onClick={() =>
              update("projects", [
                ...profile.projects,
                {
                  title: "",
                  oneLiner: "",
                  bullets: [""],
                  stack: [],
                  isFeatured: false,
                  order: profile.projects.length,
                },
              ])
            }
          >
            <Plus size={14} /> Add project
          </Button>
        </div>
      </SectionCard>

      {/* Education */}
      <SectionCard title="Education" subtitle="Institution, degree, dates.">
        <div className="space-y-3">
          {profile.education.map((ed, idx) => (
            <EducationRow
              key={ed.id ?? idx}
              edu={ed}
              onChange={(updated) => {
                const next = [...profile.education];
                next[idx] = updated;
                update("education", next);
              }}
              onRemove={() => {
                update("education", profile.education.filter((_, i) => i !== idx));
              }}
            />
          ))}
          <Button
            variant="outline"
            className="w-full gap-1.5"
            onClick={() =>
              update("education", [
                ...profile.education,
                { institution: "", degree: "", order: profile.education.length },
              ])
            }
          >
            <Plus size={14} /> Add education
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <div className="mb-4">
        <h3 className="text-base font-bold text-zinc-900 dark:text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SummaryRow({
  summary,
  onChange,
  onSetDefault,
  onRemove,
}: {
  summary: ResumeSummary;
  onChange: (s: ResumeSummary) => void;
  onSetDefault: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/40 dark:bg-zinc-800/40">
      <div className="flex items-center gap-2 mb-2">
        <Input
          value={summary.label}
          onChange={(e) => onChange({ ...summary, label: e.target.value })}
          placeholder="Label (e.g. AI-eval-leaning)"
          className="max-w-xs text-sm"
        />
        <Button
          variant={summary.isDefault ? "default" : "ghost"}
          size="sm"
          onClick={onSetDefault}
          className={`gap-1 ${summary.isDefault ? "bg-emerald-600 hover:bg-emerald-500 text-white" : ""}`}
        >
          <Star size={12} fill={summary.isDefault ? "currentColor" : "none"} />
          {summary.isDefault ? "Default" : "Set default"}
        </Button>
        <Button variant="ghost" size="icon" onClick={onRemove} className="ml-auto text-red-500 hover:text-red-600">
          <Trash2 size={14} />
        </Button>
      </div>
      <Textarea
        value={summary.content}
        onChange={(e) => onChange({ ...summary, content: e.target.value })}
        placeholder="2–4 sentences. Will appear verbatim on the PDF."
        rows={3}
        maxLength={RESUME_LIMITS.SUMMARY_MAX}
      />
      <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-500 text-right tabular-nums">
        {summary.content.length} / {RESUME_LIMITS.SUMMARY_MAX}
      </p>
    </div>
  );
}

/**
 * BulletCoachButton — inline AI rewriter for a single bullet.
 * Shows the suggestion in a small inline diff with Accept / Edit / Dismiss.
 * Quietly silent on quota 429 (toast already covers it).
 */
function BulletCoachButton({
  bullet,
  role,
  userSkills,
  onAccept,
}: {
  bullet: string;
  role: { title: string; company: string };
  userSkills: string[];
  onAccept: (improved: string) => void;
}) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; improved: string; rationale: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function run() {
    if (bullet.trim().length < 3) {
      toast.error("Write a draft bullet first, then coach it.");
      return;
    }
    setState({ kind: "loading" });
    try {
      const r = await fetch("/api/resumes/coach-bullet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bullet, role, userSkills, mode: "tighten" }),
      });
      const body = await r.json();
      if (r.status === 429) {
        toast.warning(body.message ?? "AI quota hit. Try again later.");
        setState({ kind: "idle" });
        return;
      }
      if (!r.ok) {
        setState({ kind: "error", message: body.error ?? `HTTP ${r.status}` });
        return;
      }
      setState({ kind: "ready", improved: body.improved, rationale: body.rationale });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Network error" });
    }
  }

  if (state.kind === "loading") {
    return (
      <Button variant="ghost" size="icon" disabled className="text-emerald-600">
        <Loader2 size={14} className="animate-spin" />
      </Button>
    );
  }

  if (state.kind === "ready") {
    return (
      <div className="mt-1 rounded-md border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-2 text-xs space-y-1.5">
        <p className="text-emerald-900 dark:text-emerald-200 leading-snug">{state.improved}</p>
        <p className="text-[10px] text-emerald-700 dark:text-emerald-400/80 italic">{state.rationale}</p>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            onClick={() => {
              onAccept(state.improved);
              setState({ kind: "idle" });
              toast.success("Bullet updated.");
            }}
            className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
          >
            <Check size={11} /> Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setState({ kind: "idle" })}
            className="h-6 px-2 text-[10px]"
          >
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={run}
      title="AI coach — improve this bullet without inventing facts"
      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
    >
      <Sparkles size={14} />
    </Button>
  );
}

function ExperienceRow({
  exp,
  onChange,
  onRemove,
  userSkills,
}: {
  exp: ResumeExperience;
  onChange: (e: ResumeExperience) => void;
  onRemove: () => void;
  userSkills: string[];
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/40 dark:bg-zinc-800/40 space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <Input value={exp.title} onChange={(e) => onChange({ ...exp, title: e.target.value })} placeholder="Title (e.g. Software Engineer)" />
        <Input value={exp.company} onChange={(e) => onChange({ ...exp, company: e.target.value })} placeholder="Company" />
        <Input value={exp.location ?? ""} onChange={(e) => onChange({ ...exp, location: e.target.value || undefined })} placeholder="Location (optional)" />
        <div className="flex gap-2">
          <Input value={exp.startDate} onChange={(e) => onChange({ ...exp, startDate: e.target.value })} placeholder="Start (e.g. Aug 2025)" />
          <Input value={exp.endDate ?? ""} onChange={(e) => onChange({ ...exp, endDate: e.target.value || undefined })} placeholder="End or 'Present'" />
        </div>
      </div>
      <div className="space-y-1.5">
        {exp.bullets.map((b, i) => (
          <div key={i} className="space-y-1">
            <div className="flex gap-2">
              <Textarea
                value={b}
                onChange={(e) => {
                  const next = [...exp.bullets];
                  next[i] = e.target.value;
                  onChange({ ...exp, bullets: next });
                }}
                placeholder="Bullet point — verbatim in PDF"
                rows={2}
                maxLength={RESUME_LIMITS.BULLET_MAX}
                className="flex-1 text-sm"
              />
              <div className="flex flex-col gap-1">
                <BulletCoachButton
                  bullet={b}
                  role={{ title: exp.title, company: exp.company }}
                  userSkills={userSkills}
                  onAccept={(improved) => {
                    const next = [...exp.bullets];
                    next[i] = improved;
                    onChange({ ...exp, bullets: next });
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange({ ...exp, bullets: exp.bullets.filter((_, idx) => idx !== i) })}
                  disabled={exp.bullets.length <= 1}
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {exp.bullets.length < RESUME_LIMITS.MAX_BULLETS_PER_EXP && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...exp, bullets: [...exp.bullets, ""] })}
            className="gap-1.5"
          >
            <Plus size={12} /> Add bullet
          </Button>
        )}
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onRemove} className="text-red-500 hover:text-red-600 gap-1.5">
          <Trash2 size={12} /> Remove experience
        </Button>
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  onChange,
  onRemove,
  userSkills,
}: {
  project: ResumeProject;
  onChange: (p: ResumeProject) => void;
  onRemove: () => void;
  userSkills: string[];
}) {
  const [stackInput, setStackInput] = useState("");

  function addStack() {
    const s = stackInput.trim();
    if (!s) return;
    if (project.stack.some((x) => x.toLowerCase() === s.toLowerCase())) {
      setStackInput("");
      return;
    }
    onChange({ ...project, stack: [...project.stack, s] });
    setStackInput("");
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/40 dark:bg-zinc-800/40 space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <Input value={project.title} onChange={(e) => onChange({ ...project, title: e.target.value })} placeholder="Project title" />
        <Input value={project.role ?? ""} onChange={(e) => onChange({ ...project, role: e.target.value || undefined })} placeholder="Role (Solo, Lead, …)" />
      </div>
      <Input
        value={project.oneLiner}
        onChange={(e) => onChange({ ...project, oneLiner: e.target.value })}
        placeholder="One-line description"
        maxLength={200}
      />
      <div className="grid sm:grid-cols-2 gap-2">
        <Input value={project.liveUrl ?? ""} onChange={(e) => onChange({ ...project, liveUrl: e.target.value || undefined })} placeholder="Live URL (optional)" />
        <Input value={project.repoUrl ?? ""} onChange={(e) => onChange({ ...project, repoUrl: e.target.value || undefined })} placeholder="Repo URL (optional)" />
      </div>

      {/* Stack */}
      <div>
        <div className="flex gap-2 mb-1.5">
          <Input
            value={stackInput}
            onChange={(e) => setStackInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addStack();
              }
            }}
            placeholder="Tech tag, press Enter"
            className="flex-1 text-sm"
          />
          <Button onClick={addStack} variant="outline" size="sm" disabled={!stackInput.trim()}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {project.stack.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {s}
              <button onClick={() => onChange({ ...project, stack: project.stack.filter((x) => x !== s) })} className="text-zinc-400 hover:text-red-500">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Bullets */}
      <div className="space-y-1.5">
        {project.bullets.map((b, i) => (
          <div key={i} className="space-y-1">
            <div className="flex gap-2">
              <Textarea
                value={b}
                onChange={(e) => {
                  const next = [...project.bullets];
                  next[i] = e.target.value;
                  onChange({ ...project, bullets: next });
                }}
                placeholder="Bullet point"
                rows={2}
                maxLength={RESUME_LIMITS.BULLET_MAX}
                className="flex-1 text-sm"
              />
              <div className="flex flex-col gap-1">
                <BulletCoachButton
                  bullet={b}
                  role={{ title: project.role ?? "Project", company: project.title }}
                  userSkills={Array.from(new Set([...project.stack, ...userSkills]))}
                  onAccept={(improved) => {
                    const next = [...project.bullets];
                    next[i] = improved;
                    onChange({ ...project, bullets: next });
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange({ ...project, bullets: project.bullets.filter((_, idx) => idx !== i) })}
                  disabled={project.bullets.length <= 1}
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {project.bullets.length < RESUME_LIMITS.MAX_BULLETS_PER_PROJECT && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...project, bullets: [...project.bullets, ""] })}
            className="gap-1.5"
          >
            <Plus size={12} /> Add bullet
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button
          variant={project.isFeatured ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange({ ...project, isFeatured: !project.isFeatured })}
          className={`gap-1.5 ${project.isFeatured ? "bg-amber-500 hover:bg-amber-400 text-white" : ""}`}
        >
          <Star size={12} fill={project.isFeatured ? "currentColor" : "none"} />
          {project.isFeatured ? "Featured" : "Mark featured"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemove} className="text-red-500 hover:text-red-600 gap-1.5">
          <Trash2 size={12} /> Remove
        </Button>
      </div>
    </div>
  );
}

function EducationRow({
  edu,
  onChange,
  onRemove,
}: {
  edu: ResumeEducation;
  onChange: (e: ResumeEducation) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/40 dark:bg-zinc-800/40 space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <Input value={edu.institution} onChange={(e) => onChange({ ...edu, institution: e.target.value })} placeholder="Institution" />
        <Input value={edu.degree} onChange={(e) => onChange({ ...edu, degree: e.target.value })} placeholder="Degree" />
        <Input value={edu.startDate ?? ""} onChange={(e) => onChange({ ...edu, startDate: e.target.value || undefined })} placeholder="Start (optional)" />
        <Input value={edu.endDate ?? ""} onChange={(e) => onChange({ ...edu, endDate: e.target.value || undefined })} placeholder="End (optional)" />
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onRemove} className="text-red-500 hover:text-red-600 gap-1.5">
          <Trash2 size={12} /> Remove
        </Button>
      </div>
    </div>
  );
}

/**
 * Top missing-keyword suggestions across the user's shortlist. Each
 * suggestion shows "+N jobs unlocked" and an Add button — clicking adds
 * the skill straight into the master list (after honest-claim guard
 * copy). Makes profile-building feel like progress.
 *
 * Dismissed suggestions are kept client-side for the session (localStorage)
 * so the user doesn't get nagged about the same keyword they already
 * decided to skip.
 */
function SkillSuggestions({
  existingSkills,
  onAdd,
}: {
  existingSkills: string[];
  onAdd: (skill: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<SkillSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [addedThisSession, setAddedThisSession] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("jobpilot.skill-suggestions.dismissed");
        if (stored) setDismissed(new Set(JSON.parse(stored)));
      } catch {
        /* ignore */
      }
    }
    setLoading(true);
    getSkillSuggestions()
      .then((rows) => setSuggestions(rows))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch suggestions when the user adds 3+ new skills — the gaps
  // analysis may have shifted enough to surface new candidates.
  useEffect(() => {
    if (addedThisSession.size > 0 && addedThisSession.size % 3 === 0) {
      getSkillSuggestions()
        .then((rows) => setSuggestions(rows))
        .catch(() => {
          /* keep current */
        });
    }
  }, [addedThisSession]);

  const persistDismiss = (kw: string) => {
    const next = new Set(dismissed);
    next.add(kw);
    setDismissed(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          "jobpilot.skill-suggestions.dismissed",
          JSON.stringify(Array.from(next)),
        );
      } catch {
        /* ignore */
      }
    }
  };

  // Filter to what's still actionable: not already in profile, not
  // dismissed, not added this session.
  const existingLower = new Set(existingSkills.map((s) => s.toLowerCase()));
  const visible = (suggestions ?? []).filter(
    (s) => !existingLower.has(s.keyword) && !dismissed.has(s.keyword) && !addedThisSession.has(s.keyword),
  );

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <Loader2 size={10} className="animate-spin" />
        Looking at your shortlist for top-leverage skills…
      </div>
    );
  }
  if (visible.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <TrendingUp size={12} className="text-emerald-600 dark:text-emerald-400" />
        <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">
          Top-leverage skills from your shortlist
        </p>
      </div>
      <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 mb-2">
        Adding these would unlock the most jobs in your /recommended feed.
        Only add what you can honestly claim — we won&apos;t fabricate.
      </p>
      <div className="space-y-1.5">
        {visible.slice(0, 6).map((s) => (
          <div
            key={s.keyword}
            className="flex items-center justify-between gap-2 rounded-md bg-white/70 dark:bg-zinc-900/30 px-2.5 py-1.5 border border-emerald-100 dark:border-emerald-900/30"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {s.keyword}
                </span>
                <span className="text-[10px] tabular-nums text-emerald-700 dark:text-emerald-300">
                  +{s.jobCount} jobs
                </span>
                {s.hasAdjacency && (
                  <span className="text-[10px] px-1 py-0 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                    related exp
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                {s.reason}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onAdd(s.keyword);
                  const next = new Set(addedThisSession);
                  next.add(s.keyword);
                  setAddedThisSession(next);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Plus size={10} /> Add
              </button>
              <button
                type="button"
                onClick={() => persistDismiss(s.keyword)}
                className="text-zinc-400 hover:text-red-500"
                aria-label={`Dismiss ${s.keyword}`}
              >
                <X size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
