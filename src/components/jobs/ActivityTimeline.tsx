import { STAGE_CONFIG } from "@/lib/utils";
import type { Activity } from "@/types";
import {
  ArrowRight,
  MessageSquare,
  Plus,
  Clock,
} from "lucide-react";

interface ActivityTimelineProps {
  activities: Activity[];
}

const TYPE_CONFIG: Record<string, { icon: typeof ArrowRight; label: string }> = {
  stage_change: { icon: ArrowRight, label: "Stage Changed" },
  note_added: { icon: MessageSquare, label: "Note Added" },
  job_created: { icon: Plus, label: "Job Created" },
  follow_up_sent: { icon: Clock, label: "Follow-up Sent" },
  ghost_detected: { icon: Clock, label: "Marked as Ghosted" },
};

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
        const config = TYPE_CONFIG[activity.type] ?? TYPE_CONFIG.note_added;
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
              <Icon className="h-3.5 w-3.5 text-slate-500" />
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
              {activity.note && activity.type === "note_added" && (
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
