import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SOURCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  jsearch: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", label: "JSearch" },
  indeed: { bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", label: "Indeed" },
  remotive: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", label: "Remotive" },
  arbeitnow: { bg: "bg-teal-50 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-300", label: "Arbeitnow" },
  adzuna: { bg: "bg-orange-50 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", label: "Adzuna" },
  linkedin: { bg: "bg-sky-50 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300", label: "LinkedIn" },
  rozee: { bg: "bg-rose-50 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300", label: "Rozee.pk" },
  google: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", label: "Google" },
  manual: { bg: "bg-slate-50 dark:bg-zinc-700", text: "text-slate-600 dark:text-zinc-300", label: "Manual" },
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
