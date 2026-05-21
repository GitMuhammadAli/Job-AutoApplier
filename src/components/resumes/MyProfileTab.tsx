"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, FileText, PencilSimple, ShieldCheck } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ProfileEditor } from "@/components/resumes/ProfileEditor";
import type { ResumeProfile } from "@/lib/resume/types";

interface MyProfileTabProps {
  initialProfile: ResumeProfile | null | undefined;
  onProfileChange: (p: ResumeProfile) => void;
  uploadedResumes: Awaited<ReturnType<typeof import("@/app/actions/resume").getResumesWithStats>>;
}

export function MyProfileTab({
  initialProfile,
  onProfileChange,
  uploadedResumes,
}: MyProfileTabProps) {
  const [editing, setEditing] = useState(false);

  if (initialProfile === undefined) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (initialProfile === null) {
    return (
      <EmptyState uploadCount={uploadedResumes.length} />
    );
  }

  if (editing) {
    return (
      <ProfileEditor
        initialProfile={initialProfile}
        onCancel={() => setEditing(false)}
        onSave={(p) => {
          onProfileChange(p);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <ProfileSummary
      profile={initialProfile}
      onEdit={() => setEditing(true)}
    />
  );
}

function EmptyState({ uploadCount }: { uploadCount: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/40 p-8 sm:p-12">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 mb-5">
          <ShieldCheck size={14} weight="fill" className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            We manage, we never rewrite
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          You haven't built a structured profile yet.
        </h2>
        <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Once built, every JD you paste produces an ATS-clean PDF that uses only the words you wrote.
          We reorder skills, pick top projects, and select your best summary — but we never touch your
          experience bullets, titles, or dates.
        </p>

        <div className="mt-7 grid sm:grid-cols-3 gap-3">
          <PathCard
            number="1"
            title="Upload a PDF"
            description="We extract candidate fields from your existing resume. You confirm every line before save."
            ctaLabel={uploadCount > 0 ? `Pick from ${uploadCount} uploads` : "Upload a resume first"}
            ctaHref="/resumes/setup?path=upload"
            disabled={uploadCount === 0}
          />
          <PathCard
            number="2"
            title="Start from scratch"
            description="Empty profile, fill in your sections one by one. Useful if no current resume."
            ctaLabel="Start blank"
            ctaHref="/resumes/setup?path=scratch"
          />
          <PathCard
            number="3"
            title="Use existing upload"
            description="Skip the structured profile, keep using your uploaded PDFs as attachments."
            ctaLabel="Stay with uploads"
            ctaHref="#"
            disabled
            disabledNote={`Default for now (${uploadCount} PDFs available)`}
          />
        </div>
      </div>
    </div>
  );
}

function PathCard({
  number,
  title,
  description,
  ctaLabel,
  ctaHref,
  disabled,
  disabledNote,
}: {
  number: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  disabled?: boolean;
  disabledNote?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border bg-white dark:bg-zinc-900 p-4 transition-colors ${
        disabled
          ? "border-zinc-100 dark:border-zinc-900 opacity-60"
          : "border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700"
      }`}
    >
      <span className="text-[10px] font-bold tabular-nums tracking-[0.18em] text-emerald-600 dark:text-emerald-400 mb-2">
        PATH {number}
      </span>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-1.5">
        {title}
      </h3>
      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {description}
      </p>
      <div className="mt-auto pt-4">
        {disabled ? (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-500 italic">
            {disabledNote ?? "Coming soon"}
          </p>
        ) : (
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 transition-colors"
          >
            {ctaLabel}
            <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

function ProfileSummary({
  profile,
  onEdit,
}: {
  profile: ResumeProfile;
  onEdit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 mb-1">
            Structured profile
          </p>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{profile.header.fullName}</h2>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{profile.header.headline}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            {profile.header.email}
            {profile.header.location ? ` · ${profile.header.location}` : ""}
          </p>
        </div>
        <Button onClick={onEdit} variant="outline" className="gap-1.5">
          <PencilSimple size={14} />
          Edit profile
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Skills" count={profile.skills.length} locked={profile.skillsLocked} />
        <Tile label="Experiences" count={profile.experiences.length} />
        <Tile label="Projects" count={profile.projects.length} starred={profile.projects.filter((p) => p.isFeatured).length} />
        <Tile label="Summaries" count={profile.summaries.length} hint="1–3 variants" />
      </div>

      <Section title="Summaries" empty={profile.summaries.length === 0}>
        {profile.summaries.map((s) => (
          <div key={s.id ?? s.label} className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 ring-1 ring-zinc-100 dark:ring-zinc-800">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">{s.label}</span>
              {s.isDefault && (
                <span className="text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 rounded px-1.5 py-0.5">
                  Default
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{s.content}</p>
          </div>
        ))}
      </Section>

      <Section title="Skills" empty={profile.skills.length === 0}>
        <div className="flex flex-wrap gap-1.5">
          {profile.skills.map((s) => (
            <span
              key={s}
              className="text-xs px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-200 dark:ring-zinc-700/50"
            >
              {s}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Experience" empty={profile.experiences.length === 0}>
        {profile.experiences.map((e) => (
          <div key={e.id} className="rounded-lg bg-white dark:bg-zinc-900 p-3 ring-1 ring-zinc-100 dark:ring-zinc-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {e.title} <span className="font-normal text-zinc-500">· {e.company}</span>
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500 tabular-nums">
                {e.startDate}{e.endDate ? ` – ${e.endDate}` : ""}
              </p>
            </div>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
              {e.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="Projects" empty={profile.projects.length === 0}>
        {profile.projects.map((p) => (
          <div key={p.id} className="rounded-lg bg-white dark:bg-zinc-900 p-3 ring-1 ring-zinc-100 dark:ring-zinc-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {p.title}
                {p.isFeatured && (
                  <span className="ml-2 text-[9px] uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200/60 dark:ring-amber-800/30 rounded px-1.5 py-0.5">
                    Featured
                  </span>
                )}
              </p>
              {p.stack.length > 0 && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-500">{p.stack.join(" · ")}</p>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{p.oneLiner}</p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
              {p.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="Education" empty={profile.education.length === 0}>
        {profile.education.map((ed) => (
          <div key={ed.id} className="rounded-lg bg-white dark:bg-zinc-900 p-3 ring-1 ring-zinc-100 dark:ring-zinc-800 flex items-baseline justify-between gap-2">
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              <span className="font-semibold">{ed.institution}</span>
              <span className="text-zinc-500"> — {ed.degree}</span>
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 tabular-nums">
              {ed.startDate ?? ""}{ed.endDate ? ` – ${ed.endDate}` : ""}
            </p>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Tile({
  label,
  count,
  hint,
  locked,
  starred,
}: {
  label: string;
  count: number;
  hint?: string;
  locked?: boolean;
  starred?: number;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">{count}</p>
      {hint && <p className="text-[10px] text-zinc-500 dark:text-zinc-500">{hint}</p>}
      {locked && (
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Locked · JD can't add new ones</p>
      )}
      {starred !== undefined && starred > 0 && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">{starred} featured</p>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-500 mb-2.5">
        {title}
      </h3>
      {empty ? (
        <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-4 text-center text-xs text-zinc-500 dark:text-zinc-500">
          No {title.toLowerCase()} yet — add via Edit profile.
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}
