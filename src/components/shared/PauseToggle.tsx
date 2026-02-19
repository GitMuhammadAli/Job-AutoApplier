"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface PauseToggleProps {
  initialStatus: string;
}

export function PauseToggle({ initialStatus }: PauseToggleProps) {
  const [status, setStatus] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const newStatus = status === "active" ? "paused" : "active";
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountStatus: newStatus }),
        });
        if (!res.ok) throw new Error();
        setStatus(newStatus);
        toast.success(
          newStatus === "paused"
            ? "Paused — auto-apply and notifications stopped"
            : "Resumed — you're back in action!"
        );
      } catch {
        toast.error("Failed to update status");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={status === "active"}
        onCheckedChange={toggle}
        disabled={isPending}
        className="data-[state=checked]:bg-emerald-500"
      />
      <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
        {status === "active" ? "Active" : "Paused"}
      </span>
    </div>
  );
}
