import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STAGES = ["SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "GHOSTED"] as const;

export const STAGE_CONFIG = {
  SAVED: { label: "Saved", bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400", border: "border-slate-300" },
  APPLIED: { label: "Applied", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-300" },
  INTERVIEW: { label: "Interview", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-300" },
  OFFER: { label: "Offer", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-300" },
  REJECTED: { label: "Rejected", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400", border: "border-red-300" },
  GHOSTED: { label: "Ghosted", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-400", border: "border-purple-300" },
} as const;

export const PLATFORMS = ["LINKEDIN", "INDEED", "GLASSDOOR", "ROZEE_PK", "BAYT", "COMPANY_SITE", "REFERRAL", "OTHER"] as const;

export function daysAgo(date: Date | string | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}
