"use client";

import dynamic from "next/dynamic";
import { ModuleSection } from "./ModuleSection";
import { fonts } from "@/styles/tokens";

/**
 * Modules showcase — the full product told as 7 module-by-module scenes.
 * Each ModuleSection animation pauses when offscreen (IntersectionObserver
 * in ModuleSection passes an `active` prop down). So at most 1–2 animations
 * run at a time, keeping the page smooth.
 *
 * Side alternates (left/right) to give the scroll a visual rhythm.
 */

const FindJobsAnimation = dynamic(
  () => import("./modules/FindJobsAnimation").then((m) => ({ default: m.FindJobsAnimation })),
  { ssr: false },
);
const MyJobsAnimation = dynamic(
  () => import("./modules/MyJobsAnimation").then((m) => ({ default: m.MyJobsAnimation })),
  { ssr: false },
);
const ResumesAnimation = dynamic(
  () => import("./modules/ResumesAnimation").then((m) => ({ default: m.ResumesAnimation })),
  { ssr: false },
);
const TemplatesAnimation = dynamic(
  () => import("./modules/TemplatesAnimation").then((m) => ({ default: m.TemplatesAnimation })),
  { ssr: false },
);
const ApplicationsAnimation = dynamic(
  () => import("./modules/ApplicationsAnimation").then((m) => ({ default: m.ApplicationsAnimation })),
  { ssr: false },
);
const AnalyticsAnimation = dynamic(
  () => import("./modules/AnalyticsAnimation").then((m) => ({ default: m.AnalyticsAnimation })),
  { ssr: false },
);
const SystemStatusAnimation = dynamic(
  () => import("./modules/SystemStatusAnimation").then((m) => ({ default: m.SystemStatusAnimation })),
  { ssr: false },
);

export function ModulesShowcase() {
  return (
    <div id="modules">
      {/* Section intro — asymmetric, left-aligned. No centered theatre. */}
      <section className="relative py-32 md:py-40 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-900">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid lg:grid-cols-[1fr_1fr] gap-12 items-end">
            <div>
              <div className="inline-flex items-center gap-2 mb-7">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
                  Inside the pipeline
                </span>
              </div>
              <h2
                className="text-4xl md:text-6xl tracking-[-0.025em] text-zinc-900 dark:text-white leading-[0.95]"
                style={{ fontFamily: fonts.display, fontWeight: 600 }}
              >
                Seven modules.
                <br />
                <span className="text-zinc-400 dark:text-zinc-600">One pipeline.</span>
              </h2>
            </div>
            <p className="text-base md:text-lg text-zinc-600 dark:text-zinc-400 leading-[1.55] max-w-md lg:ml-auto">
              Most job search tools give you one surface. JobPilot owns the whole loop — from scraping a fresh role to landing the reply in your inbox. Each module below runs live below.
            </p>
          </div>
        </div>
      </section>

      {/* 1 — Find Jobs */}
      <ModuleSection
        id="module-find-jobs"
        number="01"
        eyebrow="Find Jobs"
        side="left"
        title={
          <>
            Nine sources. <span className="text-emerald-600 dark:text-emerald-400">One hourly sweep.</span>
          </>
        }
        body="We scrape LinkedIn, Indeed, Remote OK, Y Combinator, Wellfound, We Work Remotely, Glassdoor, ZipRecruiter, and Hacker News every hour. Each role gets dedup-checked against the global index, then scored against your resume — only matches above your threshold reach you."
        bullets={[
          "Cron-driven sweep every 60 minutes",
          "Circuit-breaker pauses any flaky source for 6h",
          "Match scoring is per-user, not global",
        ]}
      >
        <FindJobsAnimation />
      </ModuleSection>

      {/* 2 — My Jobs */}
      <ModuleSection
        id="module-my-jobs"
        number="02"
        eyebrow="My Jobs"
        side="right"
        title={
          <>
            Drag a card. <span className="text-emerald-600 dark:text-emerald-400">State stays synced.</span>
          </>
        }
        body="Kanban with four columns: Saved, Applied, Interview, Offer. Every job carries its history — when it was found, what email was sent, who replied. No spreadsheet drift. No forgotten follow-ups."
        bullets={[
          "Four columns, infinite jobs",
          "Activity log per card (emails, replies, calls)",
          "Auto-archive after configurable inactivity",
        ]}
      >
        <MyJobsAnimation />
      </ModuleSection>

      {/* 3 — Resumes (the showpiece) */}
      <ModuleSection
        id="module-resumes"
        number="03"
        eyebrow="Resumes"
        side="left"
        title={
          <>
            A resume agent that <span className="text-emerald-600 dark:text-emerald-400">manages, never rewrites.</span>
          </>
        }
        body="Three ways in: upload a PDF and we extract a structured profile (you confirm every item), start from scratch, or pick from your existing uploads. Then paste a JD and the agent reorders your skills, picks the top projects, selects the best summary, renders an ATS-clean PDF. Your bullets, companies, and dates are never touched."
        bullets={[
          "16 ATS-friendly templates — single-column and two-column",
          "Three onboarding paths · upload, scratch, or pick existing",
          "On-demand only · two clicks from open to downloaded PDF",
          "Audit-tested: every visible word in the output traces to your profile",
        ]}
        ctaLabel="Open Resumes"
        ctaHref="/dashboard/resumes"
      >
        <ResumesAnimation />
      </ModuleSection>

      {/* 4 — Templates */}
      <ModuleSection
        id="module-templates"
        number="04"
        eyebrow="Templates"
        side="right"
        title={
          <>
            One template. <span className="text-emerald-600 dark:text-emerald-400">A hundred unique emails.</span>
          </>
        }
        body="Write your outreach once with placeholders for name, role, company, and a hook. The 4-agent pipeline researches each company, drafts a tailored hook, fills the placeholders, QA-checks the result, and hands you the final email — every time, for every job."
        bullets={[
          "company-research → resume-tailor → email-writer → QA-checker",
          "Placeholders never leak into the sent email",
          "Per-template send statistics",
        ]}
      >
        <TemplatesAnimation />
      </ModuleSection>

      {/* 5 — Applications */}
      <ModuleSection
        id="module-applications"
        number="05"
        eyebrow="Applications"
        side="left"
        title={
          <>
            Sent from your Gmail. <span className="text-emerald-600 dark:text-emerald-400">Tracked everywhere.</span>
          </>
        }
        body="Every application logs Draft → Sending → Delivered → Opened → Replied. Bounces auto-pause the queue. Opens trigger a push. Replies bubble to the top of your inbox. Your SMTP credentials are AES-256-GCM encrypted at rest — only you can send."
        bullets={[
          "AES-256-GCM encrypted SMTP passwords",
          "Per-day rate limit (configurable) to avoid Gmail throttling",
          "Auto-pause on 3 consecutive bounces",
        ]}
      >
        <ApplicationsAnimation />
      </ModuleSection>

      {/* 6 — Analytics */}
      <ModuleSection
        id="module-analytics"
        number="06"
        eyebrow="Analytics"
        side="right"
        title={
          <>
            Know what's working <span className="text-emerald-600 dark:text-emerald-400">before another month.</span>
          </>
        }
        body="Apps per day. Response rate. Funnel from sent to interview to offer. Time-to-offer per role family. If a template stops getting replies, you see it the day it happens — not three weeks later when you wonder why nothing's moving."
        bullets={[
          "Daily / weekly / monthly views",
          "Per-template + per-source response rates",
          "Funnel breakdown with cohort comparisons",
        ]}
      >
        <AnalyticsAnimation />
      </ModuleSection>

      {/* 7 — System Status */}
      <ModuleSection
        id="module-system-status"
        number="07"
        eyebrow="System Status"
        side="left"
        title={
          <>
            Self-monitoring. <span className="text-emerald-600 dark:text-emerald-400">Self-healing.</span>
          </>
        }
        body="Every minute, we ping scrapers, AI providers, SMTP, and cron. If a source flakes three times in a row, it's parked for 6 hours and a healthy fallback takes over. If your inbox starts bouncing, we pause sends before damage. You see what we see."
        bullets={[
          "Live health pulses for scrapers, AI, SMTP, cron",
          "Auto-failover from Groq → Gemini on quota errors",
          "Public uptime dashboard",
        ]}
      >
        <SystemStatusAnimation />
      </ModuleSection>
    </div>
  );
}
