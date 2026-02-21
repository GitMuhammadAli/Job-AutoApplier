import { STAGE_CONFIG } from "@/lib/utils";
import type { ActivityType } from "@prisma/client";
import {
  ArrowRight,
  MessageSquare,
  Plus,
  Clock,
  Send,
  FileText,
  Copy,
  XCircle,
  Trash2,
  Bell,
  AlertTriangle,
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: ActivityType;
  description: string;
  createdAt: Date | string;
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
}

const TYPE_CONFIG: Record<
  ActivityType,
  { icon: typeof ArrowRight; label: string; color: string }
> = {
  STAGE_CHANGE: {
    icon: ArrowRight,
    label: "Stage Changed",
    color: "text-blue-500",
  },
  NOTE_ADDED: {
    icon: MessageSquare,
    label: "Note Added",
    color: "text-slate-500",
  },
  COVER_LETTER_GENERATED: {
    icon: FileText,
    label: "Cover Letter Generated",
    color: "text-violet-500",
  },
  APPLICATION_PREPARED: {
    icon: Plus,
    label: "Application Prepared",
    color: "text-emerald-500",
  },
  APPLICATION_SENT: {
    icon: Send,
    label: "Application Sent",
    color: "text-emerald-600",
  },
  APPLICATION_FAILED: {
    icon: XCircle,
    label: "Application Failed",
    color: "text-red-500",
  },
  APPLICATION_BOUNCED: {
    icon: AlertTriangle,
    label: "Email Bounced",
    color: "text-orange-500",
  },
  APPLICATION_COPIED: {
    icon: Copy,
    label: "Application Copied",
    color: "text-blue-500",
  },
  FOLLOW_UP_SENT: {
    icon: Clock,
    label: "Follow-up Sent",
    color: "text-amber-500",
  },
  FOLLOW_UP_FLAGGED: {
    icon: Clock,
    label: "Follow-up Flagged",
    color: "text-amber-400",
  },
  MANUAL_UPDATE: {
    icon: Plus,
    label: "Manual Update",
    color: "text-slate-500",
  },
  DISMISSED: { icon: Trash2, label: "Dismissed", color: "text-slate-400" },
  NOTIFICATION_SENT: {
    icon: Bell,
    label: "Notification Sent",
    color: "text-cyan-500",
  },
};

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-slate-400 dark:text-zinc-500 italic py-4">
        No activity yet.
      </p>
    );
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200 dark:bg-zinc-700" />
      {activities.map((activity) => {
        const config = TYPE_CONFIG[activity.type];
        const Icon = config.icon;

        const stageMatch = activity.description.match(/from (\w+) to (\w+)/);
        const fromConfig = stageMatch
          ? STAGE_CONFIG[stageMatch[1] as keyof typeof STAGE_CONFIG]
          : null;
        const toConfig = stageMatch
          ? STAGE_CONFIG[stageMatch[2] as keyof typeof STAGE_CONFIG]
          : null;

        return (
          <div key={activity.id} className="relative flex gap-3 pb-4">
            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm dark:shadow-zinc-900/50">
              <Icon className={`h-3.5 w-3.5 ${config.color}`} />
            </div>
            <div className="flex-1 pt-0.5">
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                {config.label}
              </p>
              {activity.type === "STAGE_CHANGE" && fromConfig && toConfig && (
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  <span className={fromConfig.text}>{fromConfig.label}</span>
                  {" → "}
                  <span className={toConfig.text}>{toConfig.label}</span>
                </p>
              )}
              {activity.type !== "STAGE_CHANGE" && activity.description && (
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  {activity.description}
                </p>
              )}
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                {new Date(activity.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
