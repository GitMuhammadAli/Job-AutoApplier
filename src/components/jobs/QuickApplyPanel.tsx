"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CopyApplicationBundle } from "@/components/applications/CopyApplicationBundle";
import { APPLY_PLATFORMS } from "@/constants/templates";
import {
  generateApplication,
  regenerateApplication,
  updateApplicationDraft,
  generateCoverLetterAction,
  markAsManuallyApplied,
} from "@/app/actions/application-email";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  FileText,
  Send,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Star,
  ChevronDown,
} from "lucide-react";

interface ApplicationData {
  id: string;
  status: string;
  subject: string;
  emailBody: string;
  coverLetter: string | null;
  recipientEmail: string;
  senderEmail: string;
  resume?: { id: string; name: string; fileName: string | null } | null;
}

interface QuickApplyPanelProps {
  userJob: {
    id: string;
    matchScore: number | null;
    matchReasons: string[];
    globalJob: {
      title: string;
      company: string;
      companyEmail: string | null;
      location: string | null;
    };
  };
  application: ApplicationData | null;
}

export function QuickApplyPanel({
  userJob,
  application: initialApp,
}: QuickApplyPanelProps) {
  const router = useRouter();
  const [application, setApplication] = useState(initialApp);
  const [isGenerating, startGenerate] = useTransition();
  const [isRegenerating, startRegenerate] = useTransition();
  const [isSending, startSend] = useTransition();
  const [generatingCL, setGeneratingCL] = useState(false);
  const [markingApplied, setMarkingApplied] = useState(false);
  const [showPlatforms, setShowPlatforms] = useState(false);
  const [applicationMode, setApplicationMode] = useState<string | null>(null);
  const [matchInfo, setMatchInfo] = useState<{
    name: string;
    tier: string;
    reason: string;
  } | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const [subject, setSubject] = useState(initialApp?.subject || "");
  const [emailBody, setEmailBody] = useState(initialApp?.emailBody || "");
  const [coverLetter, setCoverLetter] = useState(
    initialApp?.coverLetter || ""
  );
  const [recipientEmail, setRecipientEmail] = useState(
    initialApp?.recipientEmail || userJob.globalJob.companyEmail || ""
  );

  useEffect(() => {
    if (!application && !isGenerating) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch application mode for send button gating
  useEffect(() => {
    fetch("/api/applications/send-stats")
      .then((r) => r.json())
      .then(() => {
        // Stats loaded — also check mode via a lightweight settings fetch
      })
      .catch(() => {});

    fetch("/api/settings/mode")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.mode) setApplicationMode(data.mode);
      })
      .catch(() => {});
  }, []);

  function handleGenerate() {
    startGenerate(async () => {
      try {
        const result = await generateApplication(userJob.id);
        setApplication(result.application);
        setSubject(result.application.subject);
        setEmailBody(result.application.emailBody);
        setCoverLetter(result.application.coverLetter || "");
        setRecipientEmail(result.application.recipientEmail);
        setMatchInfo(result.matchedResume);
        toast.success(`Draft ready! Resume: ${result.matchedResume.name}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Generation failed"
        );
      }
    });
  }

  function handleRegenerate() {
    startRegenerate(async () => {
      try {
        const result = await regenerateApplication(userJob.id);
        setApplication(result.application);
        setSubject(result.application.subject);
        setEmailBody(result.application.emailBody);
        setCoverLetter(result.application.coverLetter || "");
        setRecipientEmail(result.application.recipientEmail);
        setMatchInfo(result.matchedResume);
        toast.success("New version generated!");
      } catch {
        toast.error("Regeneration failed. Try again.");
      }
    });
  }

  const debouncedSave = useCallback(
    (field: string, value: string) => {
      if (!application) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await updateApplicationDraft(application.id, { [field]: value });
        } catch {
          // Silent fail for auto-save
        }
      }, 500);
    },
    [application]
  );

  async function handleGenerateCoverLetter() {
    setGeneratingCL(true);
    try {
      const cl = await generateCoverLetterAction(userJob.id);
      setCoverLetter(cl);
      toast.success("Cover letter generated!");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Generation failed"
      );
    }
    setGeneratingCL(false);
  }

  async function handleMarkApplied(platform: string) {
    setMarkingApplied(true);
    try {
      await markAsManuallyApplied(userJob.id, { platform });
      toast.success("Marked as applied!");
      setShowPlatforms(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to mark applied"
      );
    }
    setMarkingApplied(false);
  }

  function handleSend() {
    if (!application?.recipientEmail && !recipientEmail) {
      toast.error(
        "No recipient email. Enter one or use 'Copy All' to apply manually."
      );
      return;
    }

    startSend(async () => {
      try {
        const res = await fetch(
          `/api/applications/${application!.id}/send`,
          { method: "POST" }
        );
        const data = await res.json();

        if (data.success) {
          toast.success(
            `Application sent to ${recipientEmail || application!.recipientEmail}!`
          );
          router.refresh();
        } else {
          toast.error(data.error || "Send failed");
        }
      } catch {
        toast.error("Network error. Try again.");
      }
    });
  }

  const score = userJob.matchScore;
  const isLoading = isGenerating || isRegenerating;
  const isSent = application?.status === "SENT";
  const isManualMode = applicationMode === "MANUAL";
  const canSend =
    !isSending &&
    !isManualMode &&
    !!application &&
    !isSent &&
    !!(recipientEmail || application?.recipientEmail);

  if (isGenerating && !application) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">Quick Apply</h3>
          {score != null && (
            <Badge
              variant="outline"
              className={`border-0 text-xs font-bold ${
                score >= 70
                  ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                  : score >= 40
                    ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                    : "bg-slate-50 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400"
              }`}
            >
              <Star className="h-3 w-3 mr-1" />
              {Math.round(score)}%
            </Badge>
          )}
        </div>
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-2/3" />
          <div className="h-10 bg-slate-100 dark:bg-zinc-700 rounded" />
          <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-1/2" />
          <div className="h-32 bg-slate-100 dark:bg-zinc-700 rounded" />
        </div>
        <p className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating email draft...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">Quick Apply</h3>
        {score != null && (
          <Badge
            variant="outline"
            className={`border-0 text-xs font-bold ${
              score >= 70
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                : score >= 40
                  ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                  : "bg-slate-50 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400"
            }`}
          >
            <Star className="h-3 w-3 mr-1" />
            {Math.round(score)}%
          </Badge>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-zinc-400">
        {userJob.globalJob.title} at {userJob.globalJob.company}
      </p>

      {/* Resume Selected */}
      {matchInfo && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 p-3 ring-1 ring-blue-100 dark:ring-blue-800/40">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 truncate">
                Resume: {matchInfo.name}
              </p>
              <p className="text-[10px] text-blue-600 dark:text-blue-400">
                {matchInfo.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {application ? (
        <>
          {/* Recipient */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400">To</Label>
            <Input
              value={recipientEmail}
              onChange={(e) => {
                setRecipientEmail(e.target.value);
                debouncedSave("recipientEmail", e.target.value);
              }}
              placeholder="Enter recipient email..."
              className="h-9 text-sm"
            />
            {!recipientEmail && (
              <p className="text-[10px] text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                No email found. Enter manually or use &quot;Copy All&quot; to
                apply via the job platform.
              </p>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              Subject
            </Label>
            <Input
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                debouncedSave("subject", e.target.value);
              }}
              className="h-9 text-sm"
            />
          </div>

          {/* Email Body */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              Email Body
            </Label>
            <Textarea
              value={emailBody}
              onChange={(e) => {
                setEmailBody(e.target.value);
                debouncedSave("emailBody", e.target.value);
              }}
              rows={8}
              className="text-sm leading-relaxed resize-y"
            />
          </div>

          {/* Cover Letter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                Cover Letter (optional)
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2 gap-1"
                onClick={handleGenerateCoverLetter}
                disabled={generatingCL}
              >
                {generatingCL ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {coverLetter ? "Regenerate" : "Generate"}
              </Button>
            </div>
            {coverLetter ? (
              <Textarea
                value={coverLetter}
                onChange={(e) => {
                  setCoverLetter(e.target.value);
                  debouncedSave("coverLetter", e.target.value);
                }}
                rows={6}
                className="text-xs leading-relaxed resize-y"
              />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 dark:border-zinc-700 p-4 text-center">
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                  Click Generate to create a cover letter
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-zinc-700">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={isLoading}
                className="gap-1.5"
              >
                {isRegenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Regenerate
              </Button>
              <div className="flex-1">
                <CopyApplicationBundle
                  senderEmail={application.senderEmail}
                  recipientEmail={recipientEmail}
                  subject={subject}
                  emailBody={emailBody}
                  coverLetter={coverLetter || null}
                  resumeName={application.resume?.name}
                  variant="full"
                />
              </div>
            </div>

            {/* Send Button */}
            {isSent ? (
              <Button
                size="sm"
                disabled
                className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-600 text-white"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Sent
              </Button>
            ) : isManualMode ? (
              <div>
                <Button
                  size="sm"
                  disabled
                  className="w-full gap-1.5 opacity-50"
                  title="Switch to Semi-Auto in Settings to send from here"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send (set up in Settings)
                </Button>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1.5 text-center">
                  You&apos;re in Manual mode. Use &quot;Copy All&quot; to apply yourself.
                  Switch to Semi-Auto in Settings to enable in-app sending.
                </p>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!canSend}
                className="w-full gap-1.5"
              >
                {isSending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {isSending ? "Sending..." : "Send"}
              </Button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200 dark:border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-zinc-800 px-2 text-slate-400 dark:text-zinc-500">
                  or apply manually
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => setShowPlatforms(!showPlatforms)}
                disabled={markingApplied}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark as Manually Applied
                <ChevronDown
                  className={`h-3 w-3 ml-auto transition-transform ${showPlatforms ? "rotate-180" : ""}`}
                />
              </Button>
              {showPlatforms && (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
                  {APPLY_PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleMarkApplied(p)}
                      disabled={markingApplied}
                      className="rounded-md bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-zinc-300 ring-1 ring-slate-200 dark:ring-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 hover:ring-blue-200 dark:hover:ring-blue-800/40 transition-colors"
                    >
                      {markingApplied ? (
                        <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                      ) : null}
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-6 space-y-3">
          <AlertCircle className="h-8 w-8 text-slate-200 dark:text-zinc-600 mx-auto" />
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            No draft yet. Click below to generate.
          </p>
          <Button size="sm" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            Generate Email
          </Button>
        </div>
      )}

      {/* Match Reasons */}
      {userJob.matchReasons.length > 0 && (
        <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/50 p-3 space-y-1.5">
          <h4 className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            Why This Match
          </h4>
          {userJob.matchReasons.map((reason, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-zinc-400"
            >
              <ArrowRight className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
              {reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
