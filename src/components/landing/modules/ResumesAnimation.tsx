"use client";

import { useEffect, useState } from "react";

/**
 * Resumes module showcase — "an agent live-managing a resume per a JD".
 *
 * Hard rule mirror: the agent NEVER rewrites bullets/companies/dates.
 * It only reorders skills, picks projects, picks a summary, picks
 * section order. This animation reflects exactly that.
 */

const ALL_SKILLS = [
  "TypeScript", "React", "Tailwind", "Python", "FastAPI",
  "Node.js", "PostgreSQL", "Docker", "Groq", "pgvector",
];

const REQUIRED_SKILLS = new Set(["Python", "FastAPI", "pgvector", "Groq"]);
const NICE_SKILLS = new Set(["TypeScript", "Docker", "PostgreSQL"]);

const PROJECTS = [
  { id: "p1", title: "DevRadar", stack: "Next.js · pgvector · Groq", matchScore: 95 },
  { id: "p2", title: "Rate-Guard", stack: "NestJS · Redis · Docker", matchScore: 78 },
  { id: "p3", title: "JobPilot", stack: "Next.js · Prisma · Groq", matchScore: 88 },
  { id: "p4", title: "Novapulsee", stack: "NestJS · Mongo · Pinecone", matchScore: 62 },
  { id: "p5", title: "Portfolio", stack: "Next.js · Framer", matchScore: 35 },
];

const SUMMARIES = [
  { id: "s1", label: "MERN-leaning", preview: "Full-stack engineer with 5+ years across MERN..." },
  { id: "s2", label: "AI-eval-leaning", preview: "Engineer focused on LLM evaluation infrastructure..." },
  { id: "s3", label: "Backend-leaning", preview: "Backend engineer with NestJS + Postgres + ..." },
];

type AgentStep = {
  label: string;
  detail: string;
};

const AGENT_STEPS: AgentStep[] = [
  { label: "Reading JD", detail: "Senior Python Engineer @ Anthropic" },
  { label: "Found 4 required skills", detail: "Python, FastAPI, pgvector, Groq" },
  { label: "Reordering skills", detail: "Promote matches, keep your master list" },
  { label: "Ranking your projects", detail: "Top 3 of 5 by stack overlap" },
  { label: "Picking summary", detail: "AI-eval-leaning fits role family" },
  { label: "Generating ATS-clean PDF", detail: "T1 · 1 page · stream-on-demand" },
  { label: "Ready", detail: "Sent to your downloads" },
];

const STEP_DURATION = 1700;

export function ResumesAnimation({ active = true }: { active?: boolean }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [pdfProgress, setPdfProgress] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setStepIdx((s) => (s + 1) % AGENT_STEPS.length), STEP_DURATION);
    return () => clearInterval(id);
  }, [active]);

  // Reset PDF progress and animate fill when reaching the generate step (index 5)
  useEffect(() => {
    if (!active) return;
    if (stepIdx === 5) {
      setPdfProgress(0);
      let p = 0;
      const id = setInterval(() => {
        p += 8;
        setPdfProgress(Math.min(p, 100));
        if (p >= 100) clearInterval(id);
      }, 100);
      return () => clearInterval(id);
    }
    if (stepIdx === 0) setPdfProgress(0);
  }, [stepIdx, active]);

  // Once we hit "Ranking projects" (idx 3), show top-3 highlighted; before that everything is dim
  const projectsRanked = stepIdx >= 3;
  const summaryPicked = stepIdx >= 4;
  const skillsReordered = stepIdx >= 2;

  const orderedSkills = skillsReordered
    ? [
        ...ALL_SKILLS.filter((s) => REQUIRED_SKILLS.has(s)),
        ...ALL_SKILLS.filter((s) => NICE_SKILLS.has(s)),
        ...ALL_SKILLS.filter((s) => !REQUIRED_SKILLS.has(s) && !NICE_SKILLS.has(s)),
      ]
    : ALL_SKILLS;

  const topProjects = projectsRanked
    ? [...PROJECTS].sort((a, b) => b.matchScore - a.matchScore).slice(0, 3).map((p) => p.id)
    : [];

  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-br from-emerald-500/15 via-teal-400/8 to-transparent rounded-[2rem] blur-3xl pointer-events-none" />

      <div className="relative rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/70 dark:ring-zinc-800 shadow-2xl shadow-emerald-500/10 overflow-hidden">
        {/* Chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 ml-2">
            JobPilot · Resumes
          </span>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-emerald-500 font-semibold uppercase tracking-wider">Agent live</span>
          </div>
        </div>

        {/* Agent action bar */}
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-emerald-50/60 dark:bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="relative flex h-7 w-7 rounded-lg bg-emerald-500 items-center justify-center text-white shadow-md shadow-emerald-500/40">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              <span className="absolute inset-0 rounded-lg bg-emerald-400 animate-ping opacity-40" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 truncate">
                {AGENT_STEPS[stepIdx].label}
              </p>
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70 truncate">
                {AGENT_STEPS[stepIdx].detail}
              </p>
            </div>
            <span className="text-[10px] tabular-nums font-bold text-emerald-700 dark:text-emerald-300">
              {stepIdx + 1}/{AGENT_STEPS.length}
            </span>
          </div>
        </div>

        {/* Workspace */}
        <div className="grid grid-cols-[1fr_1.2fr] divide-x divide-zinc-100 dark:divide-zinc-800">
          {/* Left — JD viewer */}
          <div className="p-4 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
              Job description
            </p>
            <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
              Senior Python Engineer
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-500">Anthropic · Remote</p>
            <div className="pt-2 space-y-1.5 text-[10px] leading-[1.5] text-zinc-600 dark:text-zinc-400">
              <p>You'll work on:</p>
              <ul className="pl-3 space-y-0.5 list-disc">
                <li className={REQUIRED_SKILLS.has("Python") && stepIdx >= 1 ? "text-emerald-700 dark:text-emerald-300 font-semibold" : ""}>
                  Python services
                </li>
                <li className={REQUIRED_SKILLS.has("FastAPI") && stepIdx >= 1 ? "text-emerald-700 dark:text-emerald-300 font-semibold" : ""}>
                  FastAPI APIs
                </li>
                <li className={REQUIRED_SKILLS.has("pgvector") && stepIdx >= 1 ? "text-emerald-700 dark:text-emerald-300 font-semibold" : ""}>
                  pgvector embeddings
                </li>
                <li className={REQUIRED_SKILLS.has("Groq") && stepIdx >= 1 ? "text-emerald-700 dark:text-emerald-300 font-semibold" : ""}>
                  Groq inference pipelines
                </li>
              </ul>
            </div>
          </div>

          {/* Right — resume being managed */}
          <div className="p-4 space-y-3">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
              Your resume · 1 page · ATS-clean
            </p>

            {/* Summary picker */}
            <div>
              <p className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-1">Summary</p>
              <div className="space-y-1">
                {SUMMARIES.map((s) => {
                  const picked = summaryPicked && s.id === "s2";
                  return (
                    <div
                      key={s.id}
                      className={`rounded-md px-2 py-1.5 ring-1 transition-all duration-500 ${
                        picked
                          ? "bg-emerald-500/10 ring-emerald-400 dark:ring-emerald-500/50"
                          : "bg-zinc-50 dark:bg-zinc-800/60 ring-zinc-200 dark:ring-zinc-700/40 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-semibold ${picked ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-600 dark:text-zinc-400"}`}>
                          {s.label}
                        </span>
                        {picked && (
                          <svg className="h-3 w-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.704 5.296a1 1 0 0 1 0 1.408l-8 8a1 1 0 0 1-1.408 0l-4-4a1 1 0 1 1 1.408-1.408L8 12.59l7.296-7.294a1 1 0 0 1 1.408 0Z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Skills reorder */}
            <div>
              <p className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-1">Skills · reordered, not rewritten</p>
              <div className="flex flex-wrap gap-1">
                {orderedSkills.map((s, i) => {
                  const isMatch = REQUIRED_SKILLS.has(s);
                  const isNice = NICE_SKILLS.has(s);
                  return (
                    <span
                      key={s}
                      className={`text-[9px] font-medium px-1.5 py-0.5 rounded ring-1 transition-all duration-700 ${
                        isMatch && skillsReordered
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-400 dark:ring-emerald-500/50"
                          : isNice && skillsReordered
                          ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 ring-amber-200 dark:ring-amber-800/40"
                          : "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 ring-zinc-200 dark:ring-zinc-700/40"
                      }`}
                      style={{
                        transitionDelay: `${i * 40}ms`,
                      }}
                    >
                      {s}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Projects */}
            <div>
              <p className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-1">Projects · top 3 selected</p>
              <div className="space-y-1">
                {PROJECTS.map((p) => {
                  const picked = topProjects.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`rounded-md px-2 py-1 ring-1 transition-all duration-500 ${
                        picked
                          ? "bg-emerald-500/10 ring-emerald-400 dark:ring-emerald-500/50"
                          : projectsRanked
                          ? "bg-zinc-50 dark:bg-zinc-800/40 ring-zinc-200/60 dark:ring-zinc-700/30 opacity-40"
                          : "bg-zinc-50 dark:bg-zinc-800/60 ring-zinc-200 dark:ring-zinc-700/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-[10px] font-semibold truncate ${picked ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-700 dark:text-zinc-300"}`}>
                            {p.title}
                          </p>
                          <p className="text-[8px] text-zinc-400 dark:text-zinc-500 truncate">{p.stack}</p>
                        </div>
                        {projectsRanked && (
                          <span className={`text-[9px] font-bold tabular-nums ${picked ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-600"}`}>
                            {p.matchScore}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* PDF generation footer */}
        <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <svg className="h-4 w-4 text-zinc-500 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                  resume_anthropic_python.pdf
                </span>
                <span className="text-[10px] tabular-nums text-zinc-500 dark:text-zinc-500">
                  {pdfProgress}%
                </span>
              </div>
              <div className="h-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-150"
                  style={{ width: `${pdfProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
