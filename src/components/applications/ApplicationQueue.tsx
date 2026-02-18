"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  CheckSquare,
  Square,
  Trash2,
  Send,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyApplicationBundle } from "./CopyApplicationBundle";
import {
  markApplicationReady,
  markApplicationManual,
  bulkMarkReady,
  deleteApplication,
} from "@/app/actions/application";
import type { ApplicationStatus } from "@prisma/client";

type ApplicationWithRelations = Awaited<
  ReturnType<typeof import("@/app/actions/application").getApplications>
>[number];

interface ApplicationQueueProps {
  applications: ApplicationWithRelations[];
  counts: {
    draft: number;
    ready: number;
    sent: number;
    failed: number;
    bounced: number;
    total: number;
  };
}

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  DRAFT: { label: "Draft", variant: "secondary", className: "bg-amber-100 text-amber-800 border-amber-200" },
  READY: { label: "Ready", variant: "default", className: "bg-blue-100 text-blue-800 border-blue-200" },
  SENDING: { label: "Sending", variant: "outline", className: "bg-slate-100 text-slate-700" },
  SENT: { label: "Sent", variant: "default", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  FAILED: { label: "Failed", variant: "destructive", className: "bg-red-100 text-red-800 border-red-200" },
  BOUNCED: { label: "Bounced", variant: "destructive", className: "bg-rose-100 text-rose-800 border-rose-200" },
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <Badge
      variant={config.variant}
      className={config.className ?? ""}
    >
      {config.label}
    </Badge>
  );
}

function ApplicationCard({
  app,
  selected,
  onToggleSelect,
  onRefresh,
}: {
  app: ApplicationWithRelations;
  selected: boolean;
  onToggleSelect: () => void;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleMarkReady = async () => {
    setLoading("ready");
    try {
      await markApplicationReady(app.id);
      toast.success("Marked as ready");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark ready");
    } finally {
      setLoading(null);
    }
  };

  const handleMarkManual = async () => {
    setLoading("manual");
    try {
      await markApplicationManual(app.id);
      toast.success("Marked as manually applied");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark manual");
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async () => {
    setLoading("delete");
    try {
      await deleteApplication(app.id);
      toast.success("Application deleted");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setLoading(null);
    }
  };

  const job = app.userJob.globalJob;
  const matchScore = app.userJob.matchScore;
  const createdDate = typeof app.createdAt === "string" ? new Date(app.createdAt) : app.createdAt;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start gap-3 pb-2">
        <button
          type="button"
          onClick={onToggleSelect}
          className="mt-0.5 shrink-0 rounded p-0.5 hover:bg-slate-100 transition-colors"
          aria-label={selected ? "Deselect" : "Select"}
        >
          {selected ? (
            <CheckSquare className="h-4 w-4 text-blue-600" />
          ) : (
            <Square className="h-4 w-4 text-slate-300" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900 truncate">{job.title}</h3>
            <Badge variant="outline" className="text-[10px] font-medium shrink-0">
              {job.source}
            </Badge>
            <StatusBadge status={app.status} />
          </div>
          <p className="text-sm text-slate-600 mt-0.5">{job.company}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
            <span title="Recipient">{app.recipientEmail}</span>
            {matchScore != null && (
              <span>Match: {Math.round(matchScore)}%</span>
            )}
            {app.resume?.name && (
              <span>Resume: {app.resume.name}</span>
            )}
            <span>{formatDistanceToNow(createdDate, { addSuffix: true })}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex flex-wrap gap-2">
          {app.status === "DRAFT" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleMarkReady}
              disabled={!!loading}
              className="gap-1.5"
            >
              {loading === "ready" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Mark Ready
            </Button>
          )}
          <CopyApplicationBundle
            senderEmail={app.senderEmail}
            recipientEmail={app.recipientEmail}
            subject={app.subject}
            emailBody={app.emailBody}
            coverLetter={app.coverLetter}
            resumeName={app.resume?.name}
            variant="compact"
          />
          {(app.status === "DRAFT" || app.status === "READY") && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkManual}
              disabled={!!loading}
              className="gap-1.5"
            >
              {loading === "manual" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Mark Manual
            </Button>
          )}
          {app.status === "DRAFT" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={!!loading}
              className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {loading === "delete" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ApplicationQueue({ applications, counts }: ApplicationQueueProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const getFilteredForTab = (tab: string) =>
    tab === "all"
      ? applications
      : applications.filter((a) => a.status === tab.toUpperCase());

  const filteredApplications = getFilteredForTab(activeTab);

  const selectedDrafts = filteredApplications.filter(
    (a) => selectedIds.has(a.id) && a.status === "DRAFT"
  );
  const selectedCount = filteredApplications.filter((a) =>
    selectedIds.has(a.id)
  ).length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCount === filteredApplications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApplications.map((a) => a.id)));
    }
  };

  const handleBulkMarkReady = async () => {
    const ids = selectedDrafts.map((a) => a.id);
    if (ids.length === 0) {
      toast.error("Select draft applications first");
      return;
    }
    setBulkLoading(true);
    try {
      const count = await bulkMarkReady(ids);
      toast.success(`${count} application(s) marked ready`);
      setSelectedIds(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    const toDelete = selectedDrafts.map((a) => a.id);
    if (toDelete.length === 0) {
      toast.error("Select draft applications first");
      return;
    }
    setBulkLoading(true);
    try {
      for (const id of toDelete) {
        await deleteApplication(id);
      }
      toast.success(`${toDelete.length} application(s) deleted`);
      setSelectedIds(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const refresh = () => router.refresh();

  const renderTabContent = (tabValue: string) => {
    const list = getFilteredForTab(tabValue);
    return (
      <ApplicationList
        applications={list}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onRefresh={refresh}
        allSelected={selectedCount === list.length && list.length > 0}
      />
    );
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="all" className="gap-1.5">
            All
            <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">
              {counts.total}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="draft" className="gap-1.5">
            Draft
            <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">
              {counts.draft}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="ready" className="gap-1.5">
            Ready
            <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">
              {counts.ready}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-1.5">
            Sent
            <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">
              {counts.sent}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="failed" className="gap-1.5">
            Failed
            <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">
              {counts.failed}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {selectedCount > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border bg-slate-50 px-4 py-2">
            <span className="text-sm font-medium text-slate-700">
              {selectedCount} selected
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleBulkMarkReady}
              disabled={bulkLoading || selectedDrafts.length === 0}
              className="gap-1.5"
            >
              {bulkLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Mark All Ready
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkDelete}
              disabled={bulkLoading || selectedDrafts.length === 0}
              className="gap-1.5 text-red-600 hover:text-red-700"
            >
              {bulkLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete Selected
            </Button>
          </div>
        )}

        <TabsContent value="all" className="mt-4">
          {renderTabContent("all")}
        </TabsContent>
        <TabsContent value="draft" className="mt-4">
          {renderTabContent("draft")}
        </TabsContent>
        <TabsContent value="ready" className="mt-4">
          {renderTabContent("ready")}
        </TabsContent>
        <TabsContent value="sent" className="mt-4">
          {renderTabContent("sent")}
        </TabsContent>
        <TabsContent value="failed" className="mt-4">
          {renderTabContent("failed")}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ApplicationList({
  applications,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onRefresh,
  allSelected,
}: {
  applications: ApplicationWithRelations[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onRefresh: () => void;
  allSelected: boolean;
}) {
  if (applications.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
        <p className="text-sm text-slate-500">No applications in this tab</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSelectAll}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
        >
          {allSelected ? (
            <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
          ) : (
            <Square className="h-3.5 w-3.5 text-slate-300" />
          )}
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {applications.map((app) => (
          <ApplicationCard
            key={app.id}
            app={app}
            selected={selectedIds.has(app.id)}
            onToggleSelect={() => onToggleSelect(app.id)}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}
