import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

interface JobPilotLoaderProps {
  /** "full" centers in viewport, "inline" fits inside its container */
  variant?: "full" | "inline";
  /** Optional text below the icon (e.g. "Loading jobs…") */
  label?: string;
  className?: string;
}

export function JobPilotLoader({
  variant = "full",
  label,
  className,
}: JobPilotLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        variant === "full" && "min-h-[60vh]",
        variant === "inline" && "py-16",
        className
      )}
      role="status"
      aria-label={label ?? "Loading"}
    >
      {/* Animated logo mark */}
      <div className="relative">
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 opacity-20 blur-xl animate-loader-glow" />

        {/* Orbiting dot */}
        <div className="absolute inset-[-8px] animate-loader-orbit">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-gradient-to-r from-blue-400 to-violet-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
        </div>

        {/* Icon container */}
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-blue-500/20 animate-loader-breathe">
          <Zap className="h-7 w-7 text-white drop-shadow-sm animate-loader-bolt" fill="currentColor" />
        </div>
      </div>

      {/* Brand + label */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-sm font-semibold tracking-wide text-gradient select-none">
          JobPilot
        </span>
        {label && (
          <span className="text-xs text-muted-foreground animate-loader-fade">
            {label}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-32 h-1 rounded-full bg-slate-200/60 dark:bg-zinc-700/60 overflow-hidden">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500 animate-loader-slide" />
      </div>
    </div>
  );
}

export default JobPilotLoader;
