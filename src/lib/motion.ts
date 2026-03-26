"use client";

import type { Variants, Transition } from "framer-motion";

// ─── Shared Transitions ─────────────────────────────────────────────
export const springTransition: Transition = {
  type: "spring" as const,
  stiffness: 500,
  damping: 35,
};

export const smoothTransition: Transition = {
  duration: 0.2,
  ease: [0.2, 0, 0, 1],
};

export const gentleSpring: Transition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
};

// ─── Fade Variants ──────────────────────────────────────────────────
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.2, 0, 0, 1] },
  },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.2, 0, 0, 1] },
  },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: [0.2, 0, 0, 1] },
  },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: [0.2, 0, 0, 1] },
  },
};

// ─── Scale Variants ─────────────────────────────────────────────────
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: [0.2, 0, 0, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.15 },
  },
};

// ─── Stagger Container ─────────────────────────────────────────────
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.04,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.2, 0, 0, 1] },
  },
};

// ─── Hover / Tap ────────────────────────────────────────────────────
export const hoverScale = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: springTransition,
};

export const hoverLift = {
  whileHover: { y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.1)" },
  transition: { type: "spring" as const, stiffness: 500, damping: 30 },
};

export const buttonTap = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: { type: "spring" as const, stiffness: 600, damping: 30 },
};

// ─── Page Transition ────────────────────────────────────────────────
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.2, 0, 0, 1] },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15 },
  },
};

// ─── Modal / Dialog ─────────────────────────────────────────────────
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 500, damping: 32 },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 4,
    transition: { duration: 0.15 },
  },
};

// ─── Toast / Notification ───────────────────────────────────────────
export const slideInFromRight: Variants = {
  hidden: { opacity: 0, x: 60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 500, damping: 30 },
  },
  exit: {
    opacity: 0,
    x: 60,
    transition: { duration: 0.15 },
  },
};

// ─── Progress Bar ───────────────────────────────────────────────────
export const progressFill = (width: number): Variants => ({
  hidden: { width: 0 },
  visible: {
    width: `${width}%`,
    transition: { duration: 0.6, ease: [0.2, 0, 0, 1] },
  },
});

// ─── Number Counter ─────────────────────────────────────────────────
export const counterConfig = {
  duration: 0.8,
  ease: [0.2, 0, 0, 1] as number[],
};

// ─── Shake (validation error) ───────────────────────────────────────
export const shake: Variants = {
  shake: {
    x: [0, -4, 4, -2, 2, 0],
    transition: { duration: 0.3 },
  },
};

// ─── Tab indicator ──────────────────────────────────────────────────
export const tabIndicator = {
  layout: true,
  transition: { type: "spring" as const, stiffness: 500, damping: 35 },
};

// ─── Skeleton shimmer ───────────────────────────────────────────────
export const shimmer: Variants = {
  animate: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      ease: "linear",
    },
  },
};

// ─── Success checkmark ──────────────────────────────────────────────
export const successPulse: Variants = {
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: 1,
    scale: [0, 1.1, 1],
    transition: {
      duration: 0.3,
      times: [0, 0.6, 1],
      ease: "easeOut",
    },
  },
};

// ─── Scroll reveal viewport config ──────────────────────────────────
export const viewportConfig = {
  once: true,
  margin: "-60px" as const,
};
