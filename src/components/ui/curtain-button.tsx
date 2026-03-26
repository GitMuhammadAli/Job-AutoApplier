"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CurtainButtonProps {
  text: string;
  variant?: "default" | "outline";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}

const curtainTransition = { duration: 0.4, ease: [0.19, 1, 0.22, 1] as const };

export function CurtainButton({ text, variant = "default", className, onClick, disabled, type = "button" }: CurtainButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const prefersReducedMotion = useReducedMotion();
  const styles = {
    default: { base: "bg-primary text-primary-foreground", curtain: "bg-primary-foreground", hoverText: "text-primary" },
    outline: { base: "border border-input bg-background text-foreground", curtain: "bg-primary", hoverText: "text-primary-foreground" },
  };
  const s = styles[variant];
  return (
    <motion.button
      type={type}
      className={cn("relative overflow-hidden rounded-lg px-6 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", s.base, className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      disabled={disabled}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
    >
      <motion.div className={cn("absolute inset-0 z-0", s.curtain)} initial={{ y: "101%" }} animate={prefersReducedMotion ? undefined : isHovered ? { y: 0 } : { y: "101%" }} transition={curtainTransition} />
      <span className="relative z-10 flex items-center justify-center">
        <span className="relative flex h-5 flex-col items-center overflow-hidden">
          <span className="invisible">{text}</span>
          <motion.span className="absolute flex flex-col text-center" animate={prefersReducedMotion ? undefined : isHovered ? { y: "-50%" } : { y: 0 }} transition={curtainTransition}>
            <span className="flex h-5 items-center justify-center whitespace-nowrap">{text}</span>
            <span className={cn("flex h-5 items-center justify-center whitespace-nowrap", s.hoverText)} aria-hidden="true">{text}</span>
          </motion.span>
        </span>
      </span>
    </motion.button>
  );
}
