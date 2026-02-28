"use client";

import { useState, useCallback, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  CheckSquare,
  Square,
  Trash2,
  Send,
  Check,
  Loader2,
  RotateCcw,
  ExternalLink,
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
  bulkCancelDrafts,
  bulkDeleteByStatus,
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
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  }
> = {
  DRAFT: {
    label: "Draft",
    variant: "secondary",
    className:
      "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  READY: {
    label: "Ready",
    variant: "default",
    className:
      "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  SENDING: {
    label: "Sending",
    variant: "outline",
    className:
      "bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300",
  },
  SENT: {
    label: "Sent",
    variant: "default",
    className:
      "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  FAILED: {
    label: "Failed",
    variant: "destructive",
    className:
      "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  },
  BOUNCED: {
    label: "Undelivered",
    variant: "destructive",
    className:
      "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  },
  CANCELLED: {
    label: "Cancelled",
    variant: "outline",
    className:
      "bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700",
  },
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <Badge variant={config.variant} className={config.className ?? ""}>
      {config.label}
    </Badge>
  );
}

const ApplicationCard = memo(function ApplicationCard({
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

  const handleSend = useCallback(async () => {
    setLoading("send");
    try {
      const res = await fetch(`/api/applications/${app.id}/send`, {
        method: "POST",
      });
      let data: { success?: boolean; error?: string };
      try {
        data = await res.json();
      } catch {
        data = { error: res.statusText || "Invalid response" };
      }
      if (res.ok && data.success) {
        toast.success(`Sent to ${app.recipientEmail}!`);
        onRefresh();
      } else {
        toast.error(data.error || res.statusText || "Send failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }, [app.id, app.recipientEmail, onRefresh]);

  const handleMarkReady = useCallback(async () => {
    setLoading("ready");
    try {
      const result = await markApplicationReady(app.id);
      if (!result.success) { toast.error(result.error || "Failed to mark ready"); return; }
      toast.success("Marked as ready");
      onRefresh();
    } catch {
      toast.error("Failed to mark ready");
    } finally {
      setLoading(null);
    }
  }, [app.id, onRefresh]);

  const handleMarkManual = useCallback(async () => {
    setLoading("manual");
    try {
      const result = await markApplicationManual(app.id);
      if (!result.success) { toast.error(result.error || "Failed to mark manual"); return; }
      toast.success("Marked as manually applied");
      onRefresh();
    } catch {
      toast.error("Failed to mark manual");
    } finally {
      setLoading(null);
    }
  }, [app.id, onRefresh]);

  const handleDelete = useCallback(async () => {
    setLoading("delete");
    try {
      const result = await deleteApplication(app.id);
      if (!result.success) { toast.error(result.error || "Failed to delete"); return; }
      toast.success("Application deleted");
      onRefresh();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setLoading(null);
    }
  }, [app.id, onRefresh]);

  const handleRetry = useCallback(async () => {
    setLoading("retry");
    try {
      const result = await markApplicationReady(app.id);
      if (!result.success) { toast.error(result.error || "Retry failed"); return; }
      toast.success("Queued for retry");
      onRefresh();
    } catch {
      toast.error("Retry failed");
    } finally {
      setLoading(null);
    }
  }, [app.id, onRefresh]);

  const job = app.userJob.globalJob;
  const matchScore = app.userJob.matchScore;
  const createdDate =
    typeof app.createdAt === "string" ? new Date(app.createdAt) : app.createdAt;
  const jobDetailHref = `/jobs/${app.userJob.id}`;

  return (
    <Card className="group/card transition-shadow hover:shadow-md dark:hover:shadow-zinc-900/50 dark:border-zinc-700/80">
      <CardHeader className="flex flex-row items-start gap-3 pb-2">
        <button
          type="button"
          onClick={onToggleSelect}
          className="mt-0.5 shrink-0 rounded p-0.5 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
          aria-label={selected ? "Deselect" : "Select"}
        >
          {selected ? (
            <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <Square className="h-4 w-4 text-slate-300 dark:text-zinc-500" />
          )}
        </button>
        <Link href={jobDetailHref} className="flex-1 min-w-0 cursor-pointer">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-zinc-100 truncate group-hover/card:text-blue-600 dark:group-hover/card:text-blue-400 transition-colors">
              {job.title}
            </h3>
            <ExternalLink className="h-3.5 w-3.5 text-slate-300 dark:text-zinc-600 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0" />
            <Badge
              variant="outline"
              className="text-[10px] font-medium shrink-0 dark:border-zinc-600 dark:text-zinc-300"
            >
              {job.source}
            </Badge>
            <StatusBadge status={app.status} />
          </div>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-0.5">
            {job.company}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500 dark:text-zinc-400">
            <span title="Recipient">{app.recipientEmail}</span>
            {matchScore != null && (
              <span>Match: {Math.round(matchScore)}%</span>
            )}
            {app.resume?.name && <span>Resume: {app.resume.name}</span>}
            <span>{formatDistanceToNow(createdDate, { addSuffix: true })}</span>
          </div>
        </Link>
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
              Mark Ready to Send
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
              I Applied on the Site
            </Button>
          )}
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
              Retry Send
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
              Email couldn&apos;t be delivered — the address may be invalid
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
});

export function ApplicationQueue({
  applications,
  counts,
}: ApplicationQueueProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);

  const filteredApplications = useMemo(
    () => activeTab === "all" ? applications : applications.filter((a) => a.status === activeTab.toUpperCase()),
    [applications, activeTab],
  );

  const selectedDrafts = useMemo(
    () => filteredApplications.filter((a) => selectedIds.has(a.id) && a.status === "DRAFT"),
    [filteredApplications, selectedIds],
  );
  const selectedCount = useMemo(
    () => filteredApplications.filter((a) => selectedIds.has(a.id)).length,
    [filteredApplications, selectedIds],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedCount === filteredApplications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApplications.map((a) => a.id)));
    }
  }, [selectedCount, filteredApplications]);

  const handleBulkMarkReady = async () => {
    const ids = selectedDrafts.map((a) => a.id);
    if (ids.length === 0) {
      toast.error("Select draft applications first");
      return;
    }
    setBulkLoading(true);
    setBulkProgress({ current: 0, total: ids.length, label: "Marking ready" });
    try {
      const count = await bulkMarkReady(ids);
      setBulkProgress({ current: ids.length, total: ids.length, label: "Marking ready" });
      toast.success(`${count} application(s) marked ready`);
      setSelectedIds(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBulkLoading(false);
      setTimeout(() => setBulkProgress(null), 1200);
    }
  };

  const selectedSendable = filteredApplications.filter(
    (a) =>
      selectedIds.has(a.id) &&
      (a.status === "DRAFT" || a.status === "READY") &&
      !!a.recipientEmail,
  );

  const handleBulkSend = async () => {
    const apps = selectedSendable;
    if (apps.length === 0) {
      toast.error("Select applications with recipient emails first");
      return;
    }
    setBulkLoading(true);
    setBulkProgress({ current: 0, total: apps.length, label: "Sending" });
    let sent = 0;
    let failed = 0;
    let rateLimited = 0;
    try {
      for (let i = 0; i < apps.length; i++) {
        setBulkProgress({ current: i, total: apps.length, label: "Sending" });
        try {
          const res = await fetch(`/api/applications/${apps[i].id}/send`, {
            method: "POST",
          });
          const data = await res.json().catch(() => ({ success: false }));
          if (res.ok && data.success) {
            sent++;
          } else if (data.error?.includes("Wait") || data.error?.includes("rate") || data.error?.includes("limit") || res.status === 429) {
            rateLimited++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
        const isLast = i === apps.length - 1;
        if (!isLast) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      setBulkProgress({ current: apps.length, total: apps.length, label: "Sending" });
      if (sent > 0) toast.success(`${sent} application(s) sent!`);
      if (rateLimited > 0) toast.info(`${rateLimited} queued — will be sent by the next cron cycle`);
      if (failed > 0) toast.error(`${failed} failed to send`);
      setSelectedIds(new Set());
      router.refresh();
    } catch {
      toast.error("Bulk send failed");
    } finally {
      setBulkLoading(false);
      setTimeout(() => setBulkProgress(null), 1200);
    }
  };

  const handleBulkDelete = async () => {
    const toDelete = filteredApplications.filter((a) => selectedIds.has(a.id)).map((a) => a.id);
    if (toDelete.length === 0) {
      toast.error("Select applications first");
      return;
    }
    setBulkLoading(true);
    setBulkProgress({ current: 0, total: toDelete.length, label: "Deleting" });
    try {
      for (let i = 0; i < toDelete.length; i++) {
        setBulkProgress({ current: i, total: toDelete.length, label: "Deleting" });
        await deleteApplication(toDelete[i]);
      }
      setBulkProgress({ current: toDelete.length, total: toDelete.length, label: "Deleting" });
      toast.success(`${toDelete.length} application(s) deleted`);
      setSelectedIds(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBulkLoading(false);
      setTimeout(() => setBulkProgress(null), 1200);
    }
  };

  const refresh = useCallback(() => router.refresh(), [router]);

  const getFilteredForTab = useCallback((tab: string) =>
    tab === "all" ? applications : applications.filter((a) => a.status === tab.toUpperCase()),
  [applications]);

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
            <Badge
              variant="secondary"
              className="ml-0.5 h-5 px-1.5 text-[10px]"
            >
              {counts.total}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="draft" className="gap-1.5">
            Drafts
            <Badge
              variant="secondary"
              className="ml-0.5 h-5 px-1.5 text-[10px]"
            >
              {counts.draft}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="ready" className="gap-1.5">
            Ready to Send
            <Badge
              variant="secondary"
              className="ml-0.5 h-5 px-1.5 text-[10px]"
            >
              {counts.ready}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-1.5">
            Sent
            <Badge
              variant="secondary"
              className="ml-0.5 h-5 px-1.5 text-[10px]"
            >
              {counts.sent}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="failed" className="gap-1.5">
            Failed
            <Badge
              variant="secondary"
              className="ml-0.5 h-5 px-1.5 text-[10px]"
            >
              {counts.failed}
            </Badge>
          </TabsTrigger>
          {counts.bounced > 0 && (
            <TabsTrigger value="bounced" className="gap-1.5">
              Undelivered
              <Badge
                variant="secondary"
                className="ml-0.5 h-5 px-1.5 text-[10px]"
              >
                {counts.bounced}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Quick cleanup actions (no selection needed) */}
        {(counts.failed > 0 || counts.bounced > 0 || counts.draft > 2) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Quick:</span>
            {counts.failed > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[10px] gap-1 text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={async () => {
                  const result = await bulkDeleteByStatus("FAILED");
                  if (result.success) {
                    toast.success(`Deleted ${result.count} failed application(s)`);
                    router.refresh();
                  } else toast.error(result.error || "Failed");
                }}
              >
                <Trash2 className="h-3 w-3" /> Delete {counts.failed} failed
              </Button>
            )}
            {counts.bounced > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[10px] gap-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                onClick={async () => {
                  const result = await bulkDeleteByStatus("BOUNCED");
                  if (result.success) {
                    toast.success(`Deleted ${result.count} undelivered application(s)`);
                    router.refresh();
                  } else toast.error(result.error || "Failed");
                }}
              >
                <Trash2 className="h-3 w-3" /> Delete {counts.bounced} undelivered
              </Button>
            )}
            {counts.draft > 2 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[10px] gap-1 text-slate-500 dark:text-zinc-400 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-zinc-800"
                onClick={async () => {
                  const result = await bulkCancelDrafts();
                  if (result.success) {
                    toast.success(`Cancelled ${result.count} draft(s)`);
                    router.refresh();
                  } else toast.error(result.error || "Failed");
                }}
              >
                <RotateCcw className="h-3 w-3" /> Cancel all {counts.draft} drafts
              </Button>
            )}
          </div>
        )}

        {selectedCount > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 px-4 py-2">
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
                Queue All to Send
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkDelete}
                disabled={bulkLoading || selectedCount === 0}
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

            {bulkProgress && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/80 dark:bg-blue-950/30 px-4 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    {bulkProgress.label}...{" "}
                    {bulkProgress.current >= bulkProgress.total
                      ? "Done!"
                      : `${bulkProgress.current + 1} of ${bulkProgress.total}`}
                  </span>
                  <span className="tabular-nums text-blue-600/70 dark:text-blue-400/70">
                    {Math.round(
                      (bulkProgress.current / bulkProgress.total) * 100,
                    )}
                    %
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-blue-200/60 dark:bg-blue-900/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      bulkProgress.current >= bulkProgress.total
                        ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                        : "bg-gradient-to-r from-blue-400 to-blue-600"
                    }`}
                    style={{
                      width: `${Math.max(
                        (bulkProgress.current / bulkProgress.total) * 100,
                        2,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <TabsContent value="all" className="mt-4">
          {renderTabContent("all")}
        </TabsContent>
        <TabsContent value="draft" className="mt-4">
          <p className="text-xs text-slate-400 dark:text-zinc-500 mb-3">Emails not ready yet</p>
          {renderTabContent("draft")}
        </TabsContent>
        <TabsContent value="ready" className="mt-4">
          <p className="text-xs text-slate-400 dark:text-zinc-500 mb-3">Will be sent automatically</p>
          {renderTabContent("ready")}
        </TabsContent>
        <TabsContent value="sent" className="mt-4">
          <p className="text-xs text-slate-400 dark:text-zinc-500 mb-3">Successfully delivered</p>
          {renderTabContent("sent")}
        </TabsContent>
        <TabsContent value="failed" className="mt-4">
          <p className="text-xs text-slate-400 dark:text-zinc-500 mb-3">Something went wrong — you can retry</p>
          {renderTabContent("failed")}
        </TabsContent>
        {counts.bounced > 0 && (
          <TabsContent value="bounced" className="mt-4">
            <p className="text-xs text-slate-400 dark:text-zinc-500 mb-3">Email bounced — address may be invalid</p>
            {renderTabContent("bounced")}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

const PAGE_SIZE = 20;

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const visibleApps = useMemo(
    () => applications.slice(0, visibleCount),
    [applications, visibleCount],
  );
  const hasMore = visibleCount < applications.length;

  if (applications.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/50 py-12 text-center space-y-3">
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          No applications in this tab
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            Browse Jobs on Dashboard
          </Link>
        </div>
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
        <span className="text-[10px] text-slate-400 dark:text-zinc-500 ml-auto">
          Showing {visibleApps.length} of {applications.length}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {visibleApps.map((app) => (
          <ApplicationCard
            key={app.id}
            app={app}
            selected={selectedIds.has(app.id)}
            onToggleSelect={() => onToggleSelect(app.id)}
            onRefresh={onRefresh}
          />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="text-xs"
          >
            Show more ({applications.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
