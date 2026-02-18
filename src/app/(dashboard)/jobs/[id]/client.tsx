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
import { ResumeBadge } from "@/components/shared/ResumeBadge";
import { ApplyTypeBadge } from "@/components/shared/ApplyTypeBadge";
import { ActivityTimeline } from "@/components/jobs/ActivityTimeline";
import { JobForm } from "@/components/jobs/JobForm";
import { updateStage, deleteJob, addNote } from "@/app/actions/job";
import { generateCoverLetterAction } from "@/app/actions/cover-letter";
import type { Job, Resume, Stage } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ExternalLink,
  Trash2,
  Send,
  Clock,
  Building2,
  MapPin,
  DollarSign,
  User,
  Mail,
  Loader2,
  Pencil,
  ArrowLeft,
  Zap,
  Link2,
  Copy,
  Check,
  MessageSquare,
  Trophy,
  XCircle,
  FileText,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface Props {
  job: Job;
  resumes: Resume[];
}

export function JobDetailClient({ job, resumes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newNote, setNewNote] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [coverLetterOpen, setCoverLetterOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterCopied, setCoverLetterCopied] = useState(false);

  const config = STAGE_CONFIG[job.stage];
  const days = daysAgo(job.appliedDate ?? null);

  const handleStageChange = (newStage: Stage) => {
    startTransition(async () => {
      try {
        await updateStage(job.id, newStage, job.stage);
        toast.success(`Moved to ${STAGE_CONFIG[newStage].label}`);
        router.refresh();
      } catch {
        toast.error("Failed to update stage");
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteJob(job.id);
        toast.success("Job deleted");
        router.push("/");
      } catch {
        toast.error("Failed to delete");
      }
    });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    startTransition(async () => {
      try {
        await addNote(job.id, newNote);
        setNewNote("");
        toast.success("Note added");
        router.refresh();
      } catch {
        toast.error("Failed to add note");
      }
    });
  };

  const handleGenerateCoverLetter = async () => {
    setCoverLetterLoading(true);
    setCoverLetter("");
    setCoverLetterOpen(true);
    const result = await generateCoverLetterAction(job.id);
    if (result.error) {
      toast.error(result.error);
      setCoverLetterOpen(false);
    } else {
      setCoverLetter(result.coverLetter || "");
    }
    setCoverLetterLoading(false);
  };

  const handleCopyCoverLetter = () => {
    navigator.clipboard.writeText(coverLetter);
    setCoverLetterCopied(true);
    toast.success("Cover letter copied");
    setTimeout(() => setCoverLetterCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-5 animate-slide-up px-0 sm:px-0">
      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to pipeline
      </Link>

      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-white p-4 sm:p-5 shadow-sm ring-1 ring-slate-100/80">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${config.gradient}`} />

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{job.company}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">{job.role}</h1>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <Badge className={`${config.bg} ${config.text} border-0 font-semibold`}>
                {config.label}
              </Badge>
              {job.applyType && job.applyType !== "UNKNOWN" && (
                <ApplyTypeBadge applyType={job.applyType} />
              )}
              <PlatformBadge platform={job.platform} />
              <ResumeBadge resume={job.resumeUsed} />
              {job.matchScore != null && job.matchScore > 0 && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold rounded px-1.5 py-0.5 ${
                  job.matchScore >= 70 ? "bg-emerald-50 text-emerald-700" : job.matchScore >= 40 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                }`}>
                  <Zap className="h-2.5 w-2.5" />
                  {job.matchScore}% match
                </span>
              )}
              {days !== null && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {days === 0 ? "Applied today" : `${days}d ago`}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="shadow-sm text-violet-600 border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              onClick={handleGenerateCoverLetter}
              disabled={coverLetterLoading}
            >
              {coverLetterLoading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5 mr-1.5" />
              )}
              Cover Letter
            </Button>
            {job.url && (
              <Button variant="outline" size="sm" asChild className="shadow-sm">
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  View Job
                </a>
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {job.role} at {job.company} and all its activity history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Salary if present */}
        {job.salary && (
          <div className="mt-3 flex items-center gap-1.5 text-emerald-600 font-semibold text-sm">
            <DollarSign className="h-4 w-4" />
            {job.salary}
          </div>
        )}
      </div>

      {/* Stage quick buttons */}
      <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
        <p className="text-[10px] text-slate-400 mb-2 font-bold uppercase tracking-wider">Move to stage</p>
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s) => {
            const sc = STAGE_CONFIG[s];
            const isCurrent = s === job.stage;
            return (
              <Button
                key={s}
                variant={isCurrent ? "default" : "outline"}
                size="sm"
                disabled={isCurrent || isPending}
                onClick={() => handleStageChange(s as Stage)}
                className={`h-8 text-xs ${isCurrent ? "" : "hover:shadow-sm"}`}
              >
                <div className={`h-1.5 w-1.5 rounded-full ${sc.dot} mr-1.5`} />
                {sc.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100/80">
          <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
          <TabsTrigger value="edit" className="text-xs">
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs">
            Activity ({job.activities?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 space-y-3">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500" />
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Job Info</h3>
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={job.location || "Not specified"} />
              <InfoRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Salary" value={job.salary || "Not specified"} />
              <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="Work Type" value={job.workType} />
              {job.url && (
                <InfoRow
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                  label="URL"
                  value={
                    <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[200px] inline-block text-xs">
                      {(() => { try { return new URL(job.url).hostname; } catch { return job.url; } })()}
                    </a>
                  }
                />
              )}
            </div>

            <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 space-y-3">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 to-purple-500" />
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact & Dates</h3>
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Name" value={job.contactName || "Not specified"} />
              <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={
                job.contactEmail ? (
                  <a href={`mailto:${job.contactEmail}`} className="text-blue-600 hover:underline text-xs">{job.contactEmail}</a>
                ) : "Not specified"
              } />
              <InfoRow icon={<Send className="h-3.5 w-3.5" />} label="Applied" value={job.appliedDate ? new Date(job.appliedDate).toLocaleDateString() : "Not yet"} />
              {job.interviewDate && (
                <InfoRow icon={<MessageSquare className="h-3.5 w-3.5" />} label="Interview" value={new Date(job.interviewDate).toLocaleDateString()} />
              )}
              <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Follow-up" value={job.followUpDate ? new Date(job.followUpDate).toLocaleDateString() : "Not set"} />
              {job.offerDate && (
                <InfoRow icon={<Trophy className="h-3.5 w-3.5" />} label="Offer" value={new Date(job.offerDate).toLocaleDateString()} />
              )}
              {job.rejectedDate && (
                <InfoRow icon={<XCircle className="h-3.5 w-3.5" />} label="Rejected" value={new Date(job.rejectedDate).toLocaleDateString()} />
              )}
            </div>
          </div>

          {/* Apply Links */}
          <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 space-y-3">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Apply Links</h3>

            {/* Primary apply button */}
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-all shadow-md hover:shadow-lg ${
                  job.applyType === "EASY_APPLY"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                    : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                }`}
              >
                <ExternalLink className="h-4 w-4" />
                {job.applyType === "EASY_APPLY" ? "Easy Apply Now" : job.applyType === "QUICK_APPLY" ? "Quick Apply" : "Apply Now"}
              </a>
            )}

            {/* Additional apply options from different platforms */}
            {Array.isArray(job.applyOptions) && job.applyOptions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 font-medium">Also available on:</p>
                {(job.applyOptions as Array<{ link: string; source: string }>).map((opt, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100 hover:ring-slate-200 transition-all group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Link2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-slate-600 capitalize">{opt.source}</span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                        {(() => { try { return new URL(opt.link).hostname; } catch { return opt.link.substring(0, 40); } })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(opt.link);
                          setCopiedLink(opt.link);
                          setTimeout(() => setCopiedLink(null), 2000);
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-slate-200 transition-colors"
                        title="Copy link"
                      >
                        {copiedLink === opt.link ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-slate-400" />
                        )}
                      </button>
                      <a
                        href={opt.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-[11px] font-semibold text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Contact email for email-type applications */}
            {job.contactEmail && (
              <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-amber-600" />
                  <div>
                    <p className="text-[10px] text-amber-700 font-medium">Apply via Email</p>
                    <p className="text-xs font-semibold text-amber-800">{job.contactEmail}</p>
                  </div>
                </div>
                <a
                  href={`mailto:${job.contactEmail}?subject=Application for ${encodeURIComponent(job.role)} - ${encodeURIComponent(job.company)}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-600 text-[11px] font-semibold text-white hover:bg-amber-700 transition-colors"
                >
                  <Send className="h-3 w-3" />
                  Send Email
                </a>
              </div>
            )}

            {!job.url && !job.contactEmail && (!Array.isArray(job.applyOptions) || job.applyOptions.length === 0) && (
              <p className="text-xs text-slate-400 text-center py-2">No apply links available. Add a URL or contact email in the Edit tab.</p>
            )}
          </div>

          {/* Notes */}
          {job.notes && (
            <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{job.notes}</p>
            </div>
          )}

          {/* Description */}
          {job.description && (
            <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Job Description</h3>
              <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">{job.description}</p>
            </div>
          )}

          {/* Add Note */}
          <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 space-y-3">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Add Note</h3>
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a note..."
              rows={3}
              className="resize-none text-sm"
            />
            <Button size="sm" onClick={handleAddNote} disabled={isPending || !newNote.trim()} className="shadow-sm">
              {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Add Note
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="edit" className="mt-4">
          <JobForm job={job} resumes={resumes} mode="edit" />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-400 to-orange-500" />
            <ActivityTimeline activities={job.activities ?? []} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Cover Letter Dialog */}
      <Dialog open={coverLetterOpen} onOpenChange={setCoverLetterOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              AI Cover Letter
              <span className="text-xs font-normal text-slate-400 ml-1">
                {job.role} at {job.company}
              </span>
            </DialogTitle>
          </DialogHeader>

          {coverLetterLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-slate-500">Generating cover letter with AI...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200/60">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-sans">
                  {coverLetter}
                </pre>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCopyCoverLetter} variant="outline" size="sm">
                  {coverLetterCopied ? (
                    <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {coverLetterCopied ? "Copied" : "Copy"}
                </Button>
                <Button
                  onClick={handleGenerateCoverLetter}
                  variant="outline"
                  size="sm"
                  disabled={coverLetterLoading}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-400 w-20 text-xs">{label}</span>
      <span className="text-slate-700 font-medium text-xs">{value}</span>
    </div>
  );
}
