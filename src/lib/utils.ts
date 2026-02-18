import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STAGES = ["SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "GHOSTED"] as const;

export const STAGE_CONFIG = {
  SAVED: { label: "Saved", bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400", border: "border-slate-300", gradient: "from-slate-400 to-slate-500", ring: "ring-slate-200" },
  APPLIED: { label: "Applied", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-300", gradient: "from-blue-500 to-blue-600", ring: "ring-blue-200" },
  INTERVIEW: { label: "Interview", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-300", gradient: "from-amber-400 to-amber-500", ring: "ring-amber-200" },
  OFFER: { label: "Offer", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-300", gradient: "from-emerald-500 to-emerald-600", ring: "ring-emerald-200" },
  REJECTED: { label: "Rejected", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400", border: "border-red-300", gradient: "from-red-400 to-red-500", ring: "ring-red-200" },
  GHOSTED: { label: "Ghosted", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-400", border: "border-purple-300", gradient: "from-purple-400 to-purple-500", ring: "ring-purple-200" },
} as const;


export function daysAgo(date: Date | string | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}
