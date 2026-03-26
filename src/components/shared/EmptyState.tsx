"use client";

import { motion, useReducedMotion } from "framer-motion";
import { fadeInUp } from "@/lib/motion";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="relative flex flex-col items-center justify-center py-8 text-center">
      {/* Floating background circles */}
      {!prefersReducedMotion && (
        <>
          <motion.div
            className="absolute -top-2 -left-4 w-16 h-16 rounded-full bg-primary/[0.04]"
            animate={{ y: [0, -8, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-3 -right-2 w-12 h-12 rounded-full bg-primary/[0.03]"
            animate={{ y: [0, 6, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
        </>
      )}

      {/* Icon with pulse */}
      <div className="relative mb-3">
        <div className="rounded-xl bg-slate-50 dark:bg-zinc-800 p-3 ring-1 ring-slate-100 dark:ring-zinc-700">
          <Inbox className="h-7 w-7 text-slate-300 dark:text-zinc-600" aria-hidden="true" />
        </div>
        {!prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 rounded-xl ring-2 ring-primary/10"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      <h3 className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{title}</h3>
      <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500 max-w-[200px] leading-relaxed">{description}</p>
      {actionLabel && actionHref && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="mt-3 h-7 rounded-lg text-[11px] px-3"
        >
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </motion.div>
  );
}
