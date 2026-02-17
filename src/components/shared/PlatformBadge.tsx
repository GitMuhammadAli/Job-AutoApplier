import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Platform } from "@/types";

const PLATFORM_STYLES: Record<Platform, { bg: string; text: string; label: string }> = {
  LINKEDIN: { bg: "bg-blue-50", text: "text-blue-700", label: "LinkedIn" },
  INDEED: { bg: "bg-purple-50", text: "text-purple-700", label: "Indeed" },
  GLASSDOOR: { bg: "bg-green-50", text: "text-green-700", label: "Glassdoor" },
  ROZEE_PK: { bg: "bg-orange-50", text: "text-orange-700", label: "Rozee.pk" },
  BAYT: { bg: "bg-teal-50", text: "text-teal-700", label: "Bayt" },
  COMPANY_SITE: { bg: "bg-slate-50", text: "text-slate-700", label: "Company" },
  REFERRAL: { bg: "bg-amber-50", text: "text-amber-700", label: "Referral" },
  OTHER: { bg: "bg-gray-50", text: "text-gray-600", label: "Other" },
};

export function PlatformBadge({ platform }: { platform: Platform }) {
  const style = PLATFORM_STYLES[platform];
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0 text-[10px] font-medium px-1.5 py-0",
        style.bg,
        style.text
      )}
    >
      {style.label}
    </Badge>
  );
}
