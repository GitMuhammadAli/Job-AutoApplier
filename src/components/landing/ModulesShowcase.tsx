"use client";

import dynamic from "next/dynamic";
import { ModuleSection } from "./ModuleSection";

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
      {/* Section intro */}
      <section className="relative py-24 md:py-28 bg-gradient-to-b from-white to-zinc-50/60 dark:from-zinc-950 dark:to-zinc-950">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-4">
            How it actually works
          </p>
          <h2
            className="text-3xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white leading-[1.05]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Seven modules. One pipeline.
            <br />
            <span className="text-zinc-500 dark:text-zinc-500">No tabs to juggle.</span>
          </h2>
          <p className="mt-6 text-base md:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Most job search tools give you one thing. JobPilot owns the whole loop —
            from scraping a fresh role to landing the reply in your inbox. Scroll to
            see each module live.
          </p>
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
        body="Paste a JD. The agent reorders your skills by relevance, picks the top 3 of your projects, selects the best of your pre-written summaries, then renders an ATS-clean PDF. Your bullets, companies, and dates are never touched — only ordering and selection change."
        bullets={[
          "Reorders skills · selects projects · picks summary",
          "Three templates · 1pg or 2pg target",
          "Audit-tested: every word in the PDF traces to your profile",
        ]}
        ctaLabel="See the design doc"
        ctaHref="#resumes"
        comingSoon
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
