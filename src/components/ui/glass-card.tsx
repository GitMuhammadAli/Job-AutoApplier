"use client";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  hover?: boolean;
  glow?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function GlassCard({ className, children, hover = true, glow = false }: GlassCardProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      className={cn(
        "rounded-xl border border-slate-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm",
        "transition-colors duration-300",
        hover && "hover:border-slate-300/80 dark:hover:border-zinc-600/80 hover:bg-white/90 dark:hover:bg-zinc-800/90",
        glow && "hover:shadow-[0_0_20px_rgba(59,130,246,0.06)]",
        className
      )}
      whileHover={hover && !prefersReducedMotion ? { y: -2 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {children}
    </motion.div>
  );
}
