import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

interface ResumeBadgeProps {
  resume: { name: string } | null | undefined;
}

export function ResumeBadge({ resume }: ResumeBadgeProps) {
  if (!resume) {
    return (
      <span className="text-[10px] text-slate-400 italic">No resume</span>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-0 bg-indigo-50 text-indigo-700 text-[10px] font-medium px-1.5 py-0 gap-1"
    >
      <FileText className="h-2.5 w-2.5" />
      {resume.name}
    </Badge>
  );
}
