import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STAGES = ["SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "GHOSTED"] as const;

export const STAGE_CONFIG = {
  SAVED: { label: "Saved", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", dot: "bg-slate-400", border: "border-slate-300 dark:border-slate-600", gradient: "from-slate-400 to-slate-500", ring: "ring-slate-200 dark:ring-slate-700" },
  APPLIED: { label: "Applied", bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500", border: "border-blue-300 dark:border-blue-700", gradient: "from-blue-500 to-blue-600", ring: "ring-blue-200 dark:ring-blue-800" },
  INTERVIEW: { label: "Interview", bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500", border: "border-amber-300 dark:border-amber-700", gradient: "from-amber-400 to-amber-500", ring: "ring-amber-200 dark:ring-amber-800" },
  OFFER: { label: "Offer", bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", border: "border-emerald-300 dark:border-emerald-700", gradient: "from-emerald-500 to-emerald-600", ring: "ring-emerald-200 dark:ring-emerald-800" },
  REJECTED: { label: "Rejected", bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", dot: "bg-red-400", border: "border-red-300 dark:border-red-700", gradient: "from-red-400 to-red-500", ring: "ring-red-200 dark:ring-red-800" },
  GHOSTED: { label: "Ghosted", bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-400", border: "border-purple-300 dark:border-purple-700", gradient: "from-purple-400 to-purple-500", ring: "ring-purple-200 dark:ring-purple-800" },
} as const;


export function daysAgo(date: Date | string | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}
