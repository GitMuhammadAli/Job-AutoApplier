"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { staggerContainer, staggerItem, fadeInUp } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/shared/PlatformBadge";
import { markAppliedFromSite } from "@/app/actions/job";
import { toast } from "sonner";
import {
  ExternalLink,
  Mail,
  CheckCircle2,
  Zap,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface QueueJob {
  id: string;
  matchScore: number | null;
  matchReasons: string[];
  createdAt: string | Date;
  globalJob: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    source: string;
    sourceUrl: string | null;
    applyUrl: string | null;
    companyEmail: string | null;
    emailConfidence: number | null;
    postedDate: string | Date | null;
    jobType: string | null;
  };
}

interface TodaysQueueProps {
  autoApply: QueueJob[];
  quickApply: QueueJob[];
  total: number;
}

export function TodaysQueue({ autoApply, quickApply, total }: TodaysQueueProps) {
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(true);

  const appliedCount = appliedIds.size;

  if (total === 0) return null;

  return (
    <div className="rounded-xl bg-white dark:bg-zinc-800/80 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 overflow-hidden min-w-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-3 sm:p-4 text-left min-w-0"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm shrink-0">
            <Target className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              Today&apos;s Queue
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              {appliedCount} of {total} applied today
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-zinc-700 px-2.5 py-1">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
              style={{ width: `${Math.max(8, (appliedCount / Math.max(total, 1)) * 60)}px` }}
            />
            <span className="text-[10px] font-semibold text-slate-600 dark:text-zinc-300 tabular-nums">
              {appliedCount}/{total}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="border-t border-slate-100 dark:border-zinc-700 overflow-hidden"
        >
        <div className="px-4 pb-4">
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2 mb-1">
            Jobs are split by how you can apply
          </p>

          {autoApply.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Mail className="h-3 w-3 text-emerald-500" />
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  Email Apply ({autoApply.length})
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mb-2">
                We found the company email — click to send your application
              </p>
              <motion.div className="space-y-1.5" variants={staggerContainer} initial="hidden" animate="visible">
                {autoApply.map((job) => (
                  <motion.div key={job.id} variants={staggerItem}>
                    <QueueJobRow
                      job={job}
                      isApplied={appliedIds.has(job.id)}
                      onApplied={() => setAppliedIds((prev) => new Set(prev).add(job.id))}
                      type="email"
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}

          {quickApply.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ExternalLink className="h-3 w-3 text-blue-500" />
                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                  Apply on Site ({quickApply.length})
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mb-2">
                No email found — apply directly on the job posting
              </p>
              <motion.div className="space-y-1.5" variants={staggerContainer} initial="hidden" animate="visible">
                {quickApply.map((job) => (
                  <motion.div key={job.id} variants={staggerItem}>
                    <QueueJobRow
                      job={job}
                      isApplied={appliedIds.has(job.id)}
                      onApplied={() => setAppliedIds((prev) => new Set(prev).add(job.id))}
                      type="site"
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

function QueueJobRow({
  job,
  isApplied,
  onApplied,
  type,
}: {
  job: QueueJob;
  isApplied: boolean;
  onApplied: () => void;
  type: "email" | "site";
}) {
  const [isPending, startTransition] = useTransition();
  const g = job.globalJob;
  const score = Math.round(job.matchScore ?? 0);
  const applyUrl = g.applyUrl || g.sourceUrl;
  const reason = job.matchReasons?.[0];

  const handleApplyOnSite = () => {
    if (applyUrl) {
      window.open(applyUrl, "_blank", "noopener");
    }

    startTransition(async () => {
      const result = await markAppliedFromSite(job.id, g.source);
      if (result.success) {
        onApplied();
        toast.success(`Marked as applied — ${g.company}`);
      }
    });
  };

  return (
    <div
      className={`rounded-lg px-2.5 sm:px-3 py-2 transition-colors ${
        isApplied
          ? "bg-emerald-50/50 dark:bg-emerald-900/10 ring-1 ring-emerald-200/50 dark:ring-emerald-800/30"
          : "bg-slate-50 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-700/50"
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold shrink-0 ${
            score >= 70
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
              : score >= 50
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                : "bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400"
          }`}
        >
          {score}%
        </div>

        <div className="flex-1 min-w-0">
          <Link
            href={`/jobs/${job.id}`}
            className="text-xs font-semibold text-slate-800 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-1 block"
          >
            {g.title}
          </Link>
          <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-zinc-400">
            <span className="truncate">{g.company}</span>
            {g.location && (
              <>
                <span className="text-slate-300 dark:text-zinc-600 hidden sm:inline">&middot;</span>
                <span className="truncate hidden sm:inline">{g.location}</span>
              </>
            )}
          </div>
        </div>

        <PlatformBadge source={g.source} />

        {isApplied ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Done</span>
          </span>
        ) : type === "email" ? (
          <Link href={`/jobs/${job.id}?apply=true`}>
            <Button size="sm" variant="outline" className="h-7 px-2 sm:px-2.5 text-[10px] gap-1 shrink-0 touch-manipulation">
              <Mail className="h-3 w-3" />
              <span className="hidden sm:inline">Email</span>
            </Button>
          </Link>
        ) : (
          <Button
            size="sm"
            className="h-7 px-2 sm:px-2.5 text-[10px] gap-1 bg-blue-600 hover:bg-blue-700 text-white shrink-0 touch-manipulation"
            onClick={handleApplyOnSite}
            disabled={isPending}
          >
            {isPending ? (
              <Zap className="h-3 w-3 animate-pulse" />
            ) : (
              <ExternalLink className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">Apply</span>
          </Button>
        )}
      </div>
    </div>
  );
}
