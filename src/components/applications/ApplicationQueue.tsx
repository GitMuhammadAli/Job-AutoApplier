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
  RotateCcw,
  Copy,
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
import { Mail } from "lucide-react";

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
  DRAFT: { label: "Draft", variant: "secondary", className: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
  READY: { label: "Ready", variant: "default", className: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  SENDING: { label: "Sending", variant: "outline", className: "bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300" },
  SENT: { label: "Sent", variant: "default", className: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" },
  FAILED: { label: "Failed", variant: "destructive", className: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" },
  BOUNCED: { label: "Bounced", variant: "destructive", className: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800" },
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

  const handleSend = async () => {
    setLoading("send");
    try {
      const res = await fetch(`/api/applications/${app.id}/send`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Sent to ${app.recipientEmail}!`);
        onRefresh();
      } else {
        toast.error(data.error || "Send failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  };

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

  const handleRetry = async () => {
    setLoading("retry");
    try {
      await markApplicationReady(app.id);
      toast.success("Queued for retry");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setLoading(null);
    }
  };

  const job = app.userJob.globalJob;
  const matchScore = app.userJob.matchScore;
  const createdDate = typeof app.createdAt === "string" ? new Date(app.createdAt) : app.createdAt;

  return (
    <Card className="transition-shadow hover:shadow-md dark:hover:shadow-zinc-900/50">
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
            <Square className="h-4 w-4 text-slate-300 dark:text-zinc-500" />
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
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500 dark:text-zinc-400">
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
          {(app.status === "DRAFT" || app.status === "READY") &&
            app.recipientEmail && (
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!!loading}
                className="gap-1.5"
              >
                {loading === "send" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="h-3.5 w-3.5" />
                )}
                Send
              </Button>
            )}
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
              className="gap-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
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

        {app.status === "FAILED" && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 ring-1 ring-red-200/60 dark:ring-red-800/40">
            <span className="text-xs text-red-600 dark:text-red-400 font-medium">
              Failed: {app.retryCount || 0}/3 attempts
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetry}
              disabled={!!loading}
              className="gap-1 text-xs h-7"
            >
              {loading === "retry" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Retry
            </Button>
            <CopyApplicationBundle
              senderEmail={app.senderEmail}
              recipientEmail={app.recipientEmail}
              subject={app.subject}
              emailBody={app.emailBody}
              coverLetter={app.coverLetter}
              resumeName={app.resume?.name}
              variant="compact"
            />
          </div>
        )}

        {app.status === "BOUNCED" && (
          <div className="flex items-center gap-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 px-3 py-2 ring-1 ring-orange-200/60 dark:ring-orange-800/40">
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
              Email bounced — address may be invalid
            </span>
            <CopyApplicationBundle
              senderEmail={app.senderEmail}
              recipientEmail={app.recipientEmail}
              subject={app.subject}
              emailBody={app.emailBody}
              coverLetter={app.coverLetter}
              resumeName={app.resume?.name}
              variant="compact"
            />
          </div>
        )}
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

  const selectedSendable = filteredApplications.filter(
    (a) =>
      selectedIds.has(a.id) &&
      (a.status === "DRAFT" || a.status === "READY") &&
      !!a.recipientEmail
  );

  const handleBulkSend = async () => {
    const ids = selectedSendable.map((a) => a.id);
    if (ids.length === 0) {
      toast.error("Select applications with recipient emails first");
      return;
    }
    setBulkLoading(true);
    try {
      const res = await fetch("/api/applications/bulk-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationIds: ids }),
      });
      const data = await res.json();
      if (data.sent > 0) {
        toast.success(`${data.sent} application(s) sent!`);
      }
      if (data.failed > 0) {
        toast.error(`${data.failed} failed to send`);
      }
      setSelectedIds(new Set());
      router.refresh();
    } catch {
      toast.error("Bulk send failed");
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
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 px-4 py-2">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              {selectedCount} selected
            </span>
            <Button
              size="sm"
              onClick={handleBulkSend}
              disabled={bulkLoading || selectedSendable.length === 0}
              className="gap-1.5"
            >
              {bulkLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              Send ({selectedSendable.length})
            </Button>
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
              className="gap-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
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
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/50 py-12 text-center">
        <p className="text-sm text-slate-500 dark:text-zinc-400">No applications in this tab</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSelectAll}
          className="text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 flex items-center gap-1.5"
        >
          {allSelected ? (
            <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
          ) : (
            <Square className="h-3.5 w-3.5 text-slate-300 dark:text-zinc-500" />
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
