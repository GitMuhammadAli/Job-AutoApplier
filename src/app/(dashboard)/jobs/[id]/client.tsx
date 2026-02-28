"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { STAGE_CONFIG, STAGES, daysAgo } from "@/lib/utils";
import { PlatformBadge } from "@/components/shared/PlatformBadge";
import { ActivityTimeline } from "@/components/jobs/ActivityTimeline";
import { QuickApplyPanel } from "@/components/jobs/QuickApplyPanel";
import { QuickApplyKit } from "@/components/jobs/QuickApplyKit";
import { FreshnessIndicator } from "@/components/jobs/FreshnessIndicator";
import { updateStage, dismissJob, addNote, markAppliedFromSite } from "@/app/actions/job";

import type { JobStage, ActivityType } from "@prisma/client";
import {
  ExternalLink,
  Trash2,
  Send,
  Clock,
  Building2,
  MapPin,
  ChevronLeft,
  Loader2,
  ArrowRight,
  Star,
  Tag,
  AlertCircle,
  Mail,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
} from "lucide-react";
import Link from "next/link";

interface GlobalJobData {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  salary: string | null;
  jobType: string | null;
  experienceLevel: string | null;
  category: string | null;
  skills: string[];
  source: string;
  sourceUrl: string | null;
  applyUrl: string | null;
  companyUrl: string | null;
  companyEmail: string | null;
  emailConfidence: number | null;
  emailSource: string | null;
  postedDate: Date | string | null;
  firstSeenAt: Date | string | null;
  lastSeenAt: Date | string | null;
  isActive: boolean;
}

interface ActivityData {
  id: string;
  type: ActivityType;
  description: string;
  createdAt: Date | string;
}

interface ApplicationData {
  id: string;
  status: string;
  sentAt: Date | string | null;
  subject: string;
  emailBody: string;
  coverLetter: string | null;
  recipientEmail: string;
  senderEmail: string;
  resume?: { id: string; name: string; fileName: string | null } | null;
}

interface ResumeOption {
  id: string;
  name: string;
  isDefault: boolean;
}

interface ProfileData {
  fullName: string | null;
  applicationEmail: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  githubUrl: string | null;
  experienceLevel: string | null;
  city: string | null;
  country: string | null;
}

interface JobDetailProps {
  job: {
    id: string;
    stage: JobStage;
    matchScore: number | null;
    matchReasons: string[];
    notes: string | null;
    coverLetter: string | null;
    isBookmarked: boolean;
    createdAt: Date | string;
    globalJob: GlobalJobData;
    application: ApplicationData | null;
    activities: ActivityData[];
  };
  resumes?: ResumeOption[];
  autoApply?: boolean;
  profile?: ProfileData | null;
}

export function JobDetailClient({ job, resumes = [], autoApply = false, profile = null }: JobDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [noteText, setNoteText] = useState(job.notes || "");
  const [dismissReason, setDismissReason] = useState("");
  const [markedApplied, setMarkedApplied] = useState(job.stage === "APPLIED");
  const [descExpanded, setDescExpanded] = useState(false);
  const [rawDataOpen, setRawDataOpen] = useState(false);

  const handleMarkApplied = () => {
    startTransition(async () => {
      try {
        const result = await markAppliedFromSite(job.id, job.globalJob.source);
        if (!result.success) {
          toast.error(result.error || "Failed to mark as applied");
          return;
        }
        setMarkedApplied(true);
        toast.success("Marked as applied!");
        router.refresh();
      } catch {
        toast.error("Failed to mark as applied");
      }
    });
  };

  const g = job.globalJob;
  const config = STAGE_CONFIG[job.stage];
  const days = daysAgo(g.postedDate ?? null);

  const handleStageChange = (newStage: JobStage) => {
    startTransition(async () => {
      try {
        const result = await updateStage(job.id, newStage, job.stage);
        if (!result.success) {
          toast.error(result.error || "Failed to update stage");
          return;
        }
        toast.success(`Moved to ${newStage.toLowerCase()}`);
        router.refresh();
      } catch {
        toast.error("Failed to update stage");
      }
    });
  };

  const handleDismiss = () => {
    startTransition(async () => {
      try {
        const result = await dismissJob(job.id, dismissReason || undefined);
        if (!result.success) {
          toast.error(result.error || "Failed to dismiss job");
          return;
        }
        toast.success("Job dismissed");
        router.push("/dashboard");
      } catch {
        toast.error("Failed to dismiss job");
      }
    });
  };

  const handleSaveNote = () => {
    startTransition(async () => {
      try {
        const result = await addNote(job.id, noteText);
        if (!result.success) {
          toast.error(result.error || "Failed to save note");
          return;
        }
        toast.success("Note saved");
        router.refresh();
      } catch {
        toast.error("Failed to save note");
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-3 sm:space-y-4 md:space-y-5 animate-slide-up">
      {/* Back */}
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Back to Pipeline
      </Link>

      {/* Header Card */}
      <div className="relative overflow-hidden rounded-xl bg-white dark:bg-zinc-800 p-3 sm:p-4 md:p-5 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${config.gradient}`} />

        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">{g.company}</span>
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 mt-1 break-words">{g.title}</h1>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
              <PlatformBadge source={g.source} />
              <Badge variant="outline" className={`${config.bg} ${config.text} border-0 text-[10px] sm:text-xs`}>
                {config.label}
              </Badge>
              {job.matchScore != null && (
                <Badge variant="outline" className={`border-0 text-[10px] sm:text-xs font-bold ${
                  job.matchScore >= 70 ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" :
                  job.matchScore >= 40 ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" :
                  "bg-slate-50 dark:bg-zinc-800/50 text-slate-600 dark:text-zinc-400"
                }`}>
                  <Star className="h-3 w-3 mr-0.5 sm:mr-1" />
                  {Math.round(job.matchScore)}% Match
                </Badge>
              )}
              {job.application && (
                <Badge variant="outline" className={`border-0 text-[10px] sm:text-xs ${
                  job.application.status === "SENT" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" :
                  job.application.status === "DRAFT" ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" :
                  "bg-slate-50 dark:bg-zinc-800/50 text-slate-600 dark:text-zinc-400"
                }`}>
                  <Send className="h-3 w-3 mr-0.5 sm:mr-1" />
                  {job.application.status}
                </Badge>
              )}
              <FreshnessIndicator
                lastSeenAt={g.lastSeenAt ?? null}
                firstSeenAt={g.firstSeenAt ?? null}
                isActive={g.isActive}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {g.companyEmail ? (
              <Button size="sm" className="shadow-sm text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  const panel = document.getElementById("quick-apply-panel");
                  panel?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Draft Application
              </Button>
            ) : (
              (g.applyUrl || g.sourceUrl) && (
                <Button size="sm" asChild className="shadow-sm text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  <a href={g.applyUrl || g.sourceUrl || "#"} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    View on Site
                  </a>
                </Button>
              )
            )}
            {g.companyEmail && (g.applyUrl || g.sourceUrl) && (
              <Button variant="outline" size="sm" asChild className="shadow-sm text-xs text-slate-600 dark:text-slate-300">
                <a href={g.applyUrl || g.sourceUrl || "#"} target="_blank" rel="noopener noreferrer" title="May require login on source site">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  View on Site
                </a>
              </Button>
            )}
            {!markedApplied && job.stage !== "APPLIED" && (
              <Button
                variant="outline"
                size="sm"
                className="shadow-sm text-xs"
                onClick={handleMarkApplied}
                disabled={isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                I Applied
              </Button>
            )}
            {markedApplied && (
              <Badge variant="outline" className="border-0 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Applied
              </Badge>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Dismiss
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Dismiss this job?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will hide the job from your pipeline. You can find it in dismissed jobs later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-wrap gap-1.5 py-2">
                  {DISMISS_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDismissReason(dismissReason === r ? "" : r)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        dismissReason === r
                          ? "bg-red-600 text-white"
                          : "bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDismiss} className="bg-red-600 hover:bg-red-700">
                    Dismiss
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Stage selector */}
      <div className="-mx-2 px-2 sm:mx-0 sm:px-0">
        <div className="flex gap-1 sm:gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {STAGES.map((stage) => {
            const sc = STAGE_CONFIG[stage];
            const isActive = job.stage === stage;
            return (
              <button
                key={stage}
                onClick={() => handleStageChange(stage as JobStage)}
                disabled={isPending}
                className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap touch-manipulation ${
                  isActive
                    ? `${sc.bg} ${sc.text} ring-1 ${sc.ring} shadow-sm dark:shadow-zinc-900/50`
                    : "bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                {sc.label}
                {isPending && isActive && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content: Split Layout */}
      <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-5">
        {/* Left: Job Details */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <Tabs defaultValue="details" className="space-y-0">
            <div className="-mx-1 px-1 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-thin mb-3 sm:mb-4">
              <TabsList className="bg-slate-100/80 dark:bg-zinc-700/80 rounded-lg p-0.5 w-max sm:w-auto">
                <TabsTrigger value="details" className="text-[11px] sm:text-xs rounded-md px-2.5 sm:px-3">Details</TabsTrigger>
                <TabsTrigger value="notes" className="text-[11px] sm:text-xs rounded-md px-2.5 sm:px-3">Notes</TabsTrigger>
                <TabsTrigger value="activity" className="text-[11px] sm:text-xs rounded-md px-2.5 sm:px-3">Activity</TabsTrigger>
              </TabsList>
            </div>

        <TabsContent value="details" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Info card */}
            <div className="rounded-xl bg-white dark:bg-zinc-800 p-3 sm:p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700 space-y-2.5 sm:space-y-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Job Info</h3>
              {g.location && <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={g.location} />}
              {g.salary && <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Salary" value={g.salary} />}
              {g.jobType && <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Type" value={g.jobType} />}
              {g.experienceLevel && <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Level" value={g.experienceLevel} />}
              {g.category && <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Category" value={g.category} />}
              {days !== null && <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Posted" value={`${days === 0 ? "Today" : `${days} days ago`}`} />}
              {g.companyEmail ? (
                <div className="space-y-1">
                  <InfoRow icon={<Send className="h-3.5 w-3.5" />} label="Email" value={g.companyEmail} />
                  {g.emailConfidence != null && g.emailConfidence < 80 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 ml-6 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Low confidence ({g.emailSource?.includes("guess") ? "guessed" : "scraped"}) — verify before sending
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs sm:text-sm">
                  <span className="text-slate-400 dark:text-zinc-500 mt-0.5 shrink-0"><Send className="h-3.5 w-3.5" /></span>
                  <span className="text-slate-500 dark:text-zinc-400 min-w-[50px] sm:min-w-[60px] shrink-0">Email:</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Not found — apply via link or enter manually
                  </span>
                </div>
              )}
            </div>

            {/* Skills & Match */}
            <div className="space-y-3 sm:space-y-4">
              {(g.skills ?? []).length > 0 && (
                <div className="rounded-xl bg-white dark:bg-zinc-800 p-3 sm:p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2">Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(g.skills ?? []).map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-0">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {(job.matchReasons ?? []).length > 0 && (
                <div className="rounded-xl bg-white dark:bg-zinc-800 p-3 sm:p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2">Match Reasons</h3>
                  <ul className="space-y-1">
                    {(job.matchReasons ?? []).map((reason, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-zinc-400">
                        <ArrowRight className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Quick Apply Kit */}
          {profile && (
            <QuickApplyKit
              profile={profile}
              jobId={job.id}
              jobTitle={g.title}
              company={g.company}
            />
          )}

          {/* Email availability */}
          {g.companyEmail ? (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 sm:p-4 ring-1 ring-emerald-200/50 dark:ring-emerald-800/30">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{g.companyEmail}</span>
              </div>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70 mt-1 ml-6">
                Email found — you can apply directly
                {g.emailSource && <span className="text-emerald-500/60"> · via {g.emailSource.replace(/_/g, " ")}</span>}
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 sm:p-4 ring-1 ring-amber-200/50 dark:ring-amber-800/30">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">No email found for this company</span>
              </div>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-1 ml-6">
                Use &quot;View on site&quot; or &quot;Copy kit&quot; to apply manually
              </p>
            </div>
          )}

          {/* Description */}
          {g.description && (
            <div className="rounded-xl bg-white dark:bg-zinc-800 p-3 sm:p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700">
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2">Job Description</h3>
              <div className={`text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap break-words ${
                !descExpanded && g.description.length > 1000 ? "max-h-64 overflow-hidden relative" : ""
              }`}>
                {g.description}
                {!descExpanded && g.description.length > 1000 && (
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white dark:from-zinc-800 to-transparent" />
                )}
              </div>
              {g.description.length > 1000 && (
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  {descExpanded ? <><ChevronUp className="h-3 w-3" /> Collapse</> : <><ChevronDown className="h-3 w-3" /> Show full description</>}
                </button>
              )}
            </div>
          )}

          {/* Apply links */}
          {(g.applyUrl || g.companyUrl || g.companyEmail || g.sourceUrl) && (
            <div className="rounded-xl bg-white dark:bg-zinc-800 p-3 sm:p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700">
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2">Apply Links</h3>
              <div className="space-y-2">
                {g.applyUrl && (
                  <a href={g.applyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline break-all">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Apply Link
                  </a>
                )}
                {g.sourceUrl && g.sourceUrl !== g.applyUrl && (
                  <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline break-all">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Source Link
                  </a>
                )}
                {g.companyUrl && (
                  <a href={g.companyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 hover:underline break-all">
                    <Building2 className="h-3.5 w-3.5 shrink-0" /> Company Website
                  </a>
                )}
                {g.companyEmail && (
                  <a href={`mailto:${g.companyEmail}`} className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 hover:underline break-all">
                    <Send className="h-3.5 w-3.5 shrink-0" /> {g.companyEmail}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Raw Scraper Data */}
          <div className="rounded-xl bg-white dark:bg-zinc-800 p-3 sm:p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700">
            <button
              onClick={() => setRawDataOpen(!rawDataOpen)}
              className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors w-full"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span className="font-medium">{rawDataOpen ? "Hide" : "View"} raw scraper data</span>
              {rawDataOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </button>
            {rawDataOpen && (
              <pre className="mt-3 p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg text-[10px] sm:text-xs text-slate-600 dark:text-zinc-400 overflow-x-auto max-h-96 overflow-y-auto font-mono leading-relaxed">
                {JSON.stringify({
                  title: g.title,
                  company: g.company,
                  location: g.location,
                  description: g.description ? `${g.description.substring(0, 200)}...` : null,
                  salary: g.salary,
                  jobType: g.jobType,
                  experienceLevel: g.experienceLevel,
                  category: g.category,
                  skills: g.skills,
                  source: g.source,
                  sourceUrl: g.sourceUrl,
                  applyUrl: g.applyUrl,
                  companyUrl: g.companyUrl,
                  companyEmail: g.companyEmail,
                  emailConfidence: g.emailConfidence,
                  emailSource: g.emailSource,
                  postedDate: g.postedDate,
                  firstSeenAt: g.firstSeenAt,
                  lastSeenAt: g.lastSeenAt,
                  isActive: g.isActive,
                }, null, 2)}
              </pre>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-3 sm:mt-4">
          <div className="rounded-xl bg-white dark:bg-zinc-800 p-3 sm:p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Notes</h3>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add notes about this job..."
              rows={6}
            />
            <Button onClick={handleSaveNote} disabled={isPending} size="sm">
              {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Save Note
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-3 sm:mt-4">
          <div className="rounded-xl bg-white dark:bg-zinc-800 p-3 sm:p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700">
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-4">Activity Timeline</h3>
            <ActivityTimeline activities={job.activities} />
          </div>
        </TabsContent>
          </Tabs>
        </div>

        {/* Right: Apply Panel */}
        <div className="w-full lg:w-[380px] shrink-0">
          <div id="quick-apply-panel" className="lg:sticky lg:top-16 rounded-xl bg-white dark:bg-zinc-800 p-3 sm:p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700">
            <QuickApplyPanel
              userJob={{
                id: job.id,
                matchScore: job.matchScore,
                matchReasons: job.matchReasons,
                globalJob: {
                  title: g.title,
                  company: g.company,
                  companyEmail: g.companyEmail,
                  emailConfidence: g.emailConfidence,
                  emailSource: g.emailSource,
                  location: g.location,
                  applyUrl: g.applyUrl,
                  sourceUrl: g.sourceUrl,
                },
              }}
              application={job.application}
              availableResumes={resumes}
              autoApply={autoApply}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs sm:text-sm">
      <span className="text-slate-400 dark:text-zinc-500 mt-0.5 shrink-0">{icon}</span>
      <span className="text-slate-500 dark:text-zinc-400 min-w-[50px] sm:min-w-[60px] shrink-0">{label}:</span>
      <span className="text-slate-700 dark:text-zinc-300 font-medium break-words min-w-0">{value}</span>
    </div>
  );
}

const DISMISS_REASONS = [
  "Not relevant",
  "Already applied elsewhere",
  "Salary doesn't match",
  "Other",
];
