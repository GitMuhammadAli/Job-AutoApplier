import { STAGE_CONFIG } from "@/lib/utils";
import type { Activity } from "@/types";
import {
  ArrowRight,
  MessageSquare,
  Plus,
  Clock,
  Ghost,
  Zap,
} from "lucide-react";

interface ActivityTimelineProps {
  activities: Activity[];
}

const TYPE_CONFIG: Record<string, { icon: typeof ArrowRight; label: string; color: string }> = {
  stage_change: { icon: ArrowRight, label: "Stage Changed", color: "text-blue-500" },
  note_added: { icon: MessageSquare, label: "Note Added", color: "text-slate-500" },
  job_created: { icon: Plus, label: "Job Created", color: "text-emerald-500" },
  follow_up_sent: { icon: Clock, label: "Follow-up Sent", color: "text-amber-500" },
  ghost_detected: { icon: Ghost, label: "Marked as Ghosted", color: "text-slate-400" },
  reminder: { icon: Clock, label: "Reminder", color: "text-violet-500" },
  interview_scheduled: { icon: Zap, label: "Interview Scheduled", color: "text-amber-500" },
};

const DEFAULT_CONFIG = { icon: MessageSquare, label: "Activity", color: "text-slate-500" };

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic py-4">No activity yet.</p>
    );
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" />
      {activities.map((activity) => {
        const config = TYPE_CONFIG[activity.type] ?? DEFAULT_CONFIG;
        const Icon = config.icon;
        const fromConfig = activity.fromStage
          ? STAGE_CONFIG[activity.fromStage as keyof typeof STAGE_CONFIG]
          : null;
        const toConfig = activity.toStage
          ? STAGE_CONFIG[activity.toStage as keyof typeof STAGE_CONFIG]
          : null;

        return (
          <div key={activity.id} className="relative flex gap-3 pb-4">
            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm">
              <Icon className={`h-3.5 w-3.5 ${config.color}`} />
            </div>
            <div className="flex-1 pt-0.5">
              <p className="text-sm font-medium text-slate-700">
                {config.label}
              </p>
              {activity.type === "stage_change" && fromConfig && toConfig && (
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className={fromConfig.text}>{fromConfig.label}</span>
                  {" → "}
                  <span className={toConfig.text}>{toConfig.label}</span>
                </p>
              )}
              {activity.type === "ghost_detected" && fromConfig && toConfig && (
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className={fromConfig.text}>{fromConfig.label}</span>
                  {" → "}
                  <span className={toConfig.text}>{toConfig.label}</span>
                </p>
              )}
              {activity.note && (
                <p className="text-sm text-slate-600 mt-1 bg-slate-50 rounded-lg px-3 py-2">
                  {activity.note}
                </p>
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                {new Date(activity.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
