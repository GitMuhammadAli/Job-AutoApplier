import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SOURCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  jsearch: { bg: "bg-blue-50", text: "text-blue-700", label: "JSearch" },
  indeed: { bg: "bg-purple-50", text: "text-purple-700", label: "Indeed" },
  remotive: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Remotive" },
  arbeitnow: { bg: "bg-teal-50", text: "text-teal-700", label: "Arbeitnow" },
  adzuna: { bg: "bg-orange-50", text: "text-orange-700", label: "Adzuna" },
  linkedin: { bg: "bg-sky-50", text: "text-sky-700", label: "LinkedIn" },
  rozee: { bg: "bg-rose-50", text: "text-rose-700", label: "Rozee.pk" },
  google: { bg: "bg-amber-50", text: "text-amber-700", label: "Google" },
  manual: { bg: "bg-slate-50", text: "text-slate-600", label: "Manual" },
};

export function PlatformBadge({ source }: { source: string }) {
  const style = SOURCE_STYLES[source] || SOURCE_STYLES.manual;
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
