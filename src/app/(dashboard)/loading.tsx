import { KanbanSkeleton } from "@/components/shared/Skeletons";

export default function DashboardLoading() {
  return (
    <div className="animate-slide-up">
      <KanbanSkeleton />
    </div>
  );
}
