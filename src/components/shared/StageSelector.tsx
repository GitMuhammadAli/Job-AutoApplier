"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STAGES, STAGE_CONFIG } from "@/lib/utils";
import type { Stage } from "@/types";

interface StageSelectorProps {
  currentStage: Stage;
  onStageChange: (newStage: Stage) => void;
}

export function StageSelector({ currentStage, onStageChange }: StageSelectorProps) {
  const currentIndex = STAGES.indexOf(currentStage);
  const prevStage = currentIndex > 0 ? STAGES[currentIndex - 1] : null;
  const nextStage = currentIndex < STAGES.length - 1 ? STAGES[currentIndex + 1] : null;

  return (
    <div className="flex items-center gap-1">
      {prevStage && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-lg hover:bg-slate-100"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onStageChange(prevStage as Stage);
          }}
          title={`Move to ${STAGE_CONFIG[prevStage].label}`}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      )}
      {nextStage && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-lg hover:bg-slate-100"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onStageChange(nextStage as Stage);
          }}
          title={`Move to ${STAGE_CONFIG[nextStage].label}`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
