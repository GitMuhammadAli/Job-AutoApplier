"use client";

import type { ApplyType } from "@/types";

const APPLY_TYPE_CONFIG: Record<
  ApplyType,
  { label: string; bg: string; text: string; dot: string }
> = {
  EASY_APPLY: {
    label: "Easy Apply",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  QUICK_APPLY: {
    label: "Quick Apply",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  REGULAR: {
    label: "Regular",
    bg: "bg-slate-100",
    text: "text-slate-600",
    dot: "bg-slate-400",
  },
  EMAIL: {
    label: "Email",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  UNKNOWN: {
    label: "Apply",
    bg: "bg-gray-100",
    text: "text-gray-500",
    dot: "bg-gray-400",
  },
};

interface ApplyTypeBadgeProps {
  applyType: ApplyType;
  className?: string;
}

export function ApplyTypeBadge({ applyType, className = "" }: ApplyTypeBadgeProps) {
  const config = APPLY_TYPE_CONFIG[applyType] || APPLY_TYPE_CONFIG.UNKNOWN;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${config.bg} ${config.text} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
