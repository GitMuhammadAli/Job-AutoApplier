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
import { updateStage, dismissJob, addNote } from "@/app/actions/job";
import { generateCoverLetter, saveCoverLetter } from "@/app/actions/cover-letter";
import type { JobStage, ActivityType } from "@prisma/client";
import {
  ExternalLink,
  Trash2,
  Send,
  Clock,
  Building2,
  MapPin,
  DollarSign,
  ChevronLeft,
  Loader2,
  ArrowRight,
  Star,
  Tag,
  Sparkles,
  Copy,
  FileText,
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
  postedDate: Date | string | null;
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
  recipientEmail: string;
  senderEmail: string;
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
}

export function JobDetailClient({ job }: JobDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [noteText, setNoteText] = useState(job.notes || "");
  const [coverLetterText, setCoverLetterText] = useState(job.coverLetter || "");
  const [generating, setGenerating] = useState(false);

  const g = job.globalJob;
  const config = STAGE_CONFIG[job.stage];
  const days = daysAgo(g.postedDate ?? null);

  const handleStageChange = (newStage: JobStage) => {
    startTransition(async () => {
      try {
        await updateStage(job.id, newStage, job.stage);
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
        await dismissJob(job.id);
        toast.success("Job dismissed");
        router.push("/");
      } catch {
        toast.error("Failed to dismiss job");
      }
    });
  };

  const handleSaveNote = () => {
    startTransition(async () => {
      try {
        await addNote(job.id, noteText);
        toast.success("Note saved");
        router.refresh();
      } catch {
        toast.error("Failed to save note");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-5 animate-slide-up">
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Back to Pipeline
      </Link>

      {/* Header Card */}
      <div className="relative overflow-hidden rounded-xl bg-white p-4 sm:p-5 shadow-sm ring-1 ring-slate-100/80">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${config.gradient}`} />

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{g.company}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">{g.title}</h1>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <PlatformBadge source={g.source} />
              <Badge variant="outline" className={`${config.bg} ${config.text} border-0 text-xs`}>
                {config.label}
              </Badge>
              {job.matchScore != null && (
                <Badge variant="outline" className={`border-0 text-xs font-bold ${
                  job.matchScore >= 70 ? "bg-emerald-50 text-emerald-700" :
                  job.matchScore >= 40 ? "bg-amber-50 text-amber-700" :
                  "bg-slate-50 text-slate-600"
                }`}>
                  <Star className="h-3 w-3 mr-1" />
                  {Math.round(job.matchScore)}% Match
                </Badge>
              )}
              {job.application && (
                <Badge variant="outline" className={`border-0 text-xs ${
                  job.application.status === "SENT" ? "bg-emerald-50 text-emerald-700" :
                  job.application.status === "DRAFT" ? "bg-amber-50 text-amber-700" :
                  "bg-slate-50 text-slate-600"
                }`}>
                  <Send className="h-3 w-3 mr-1" />
                  {job.application.status}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {g.applyUrl && (
              <Button variant="outline" size="sm" asChild className="shadow-sm">
                <a href={g.applyUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Apply
                </a>
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Dismiss
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Dismiss this job?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will hide the job from your pipeline. You can find it in dismissed jobs later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
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
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STAGES.map((stage) => {
          const sc = STAGE_CONFIG[stage];
          const isActive = job.stage === stage;
          return (
            <button
              key={stage}
              onClick={() => handleStageChange(stage as JobStage)}
              disabled={isPending}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? `${sc.bg} ${sc.text} ring-1 ${sc.ring} shadow-sm`
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
              {sc.label}
              {isPending && isActive && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-0">
        <TabsList className="bg-slate-100/80 rounded-lg p-0.5">
          <TabsTrigger value="details" className="text-xs rounded-md">Details</TabsTrigger>
          <TabsTrigger value="cover-letter" className="text-xs rounded-md">Cover Letter</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs rounded-md">Notes</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs rounded-md">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Info card */}
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100/80 space-y-3">
              <h3 className="text-sm font-bold text-slate-800">Job Info</h3>
              {g.location && <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={g.location} />}
              {g.salary && <InfoRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Salary" value={g.salary} />}
              {g.jobType && <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Type" value={g.jobType} />}
              {g.experienceLevel && <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Level" value={g.experienceLevel} />}
              {g.category && <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Category" value={g.category} />}
              {days !== null && <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Posted" value={`${days === 0 ? "Today" : `${days} days ago`}`} />}
              {g.companyEmail && <InfoRow icon={<Send className="h-3.5 w-3.5" />} label="Email" value={g.companyEmail} />}
            </div>

            {/* Skills & Match */}
            <div className="space-y-4">
              {g.skills.length > 0 && (
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
                  <h3 className="text-sm font-bold text-slate-800 mb-2">Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {g.skills.map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-0">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {job.matchReasons.length > 0 && (
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
                  <h3 className="text-sm font-bold text-slate-800 mb-2">Match Reasons</h3>
                  <ul className="space-y-1">
                    {job.matchReasons.map((reason, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        <ArrowRight className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {g.description && (
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
              <h3 className="text-sm font-bold text-slate-800 mb-2">Job Description</h3>
              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                {g.description}
              </div>
            </div>
          )}

          {/* Apply links */}
          {(g.applyUrl || g.companyUrl || g.companyEmail || g.sourceUrl) && (
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
              <h3 className="text-sm font-bold text-slate-800 mb-2">Apply Links</h3>
              <div className="space-y-2">
                {g.applyUrl && (
                  <a href={g.applyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> Apply Link
                  </a>
                )}
                {g.sourceUrl && g.sourceUrl !== g.applyUrl && (
                  <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> Source Link
                  </a>
                )}
                {g.companyUrl && (
                  <a href={g.companyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-700 hover:underline">
                    <Building2 className="h-3.5 w-3.5" /> Company Website
                  </a>
                )}
                {g.companyEmail && (
                  <a href={`mailto:${g.companyEmail}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-700 hover:underline">
                    <Send className="h-3.5 w-3.5" /> {g.companyEmail}
                  </a>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cover-letter" className="mt-4">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                AI Cover Letter
              </h3>
              <div className="flex gap-2">
                {coverLetterText && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(coverLetterText);
                      toast.success("Copied to clipboard");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={async () => {
                    setGenerating(true);
                    try {
                      const letter = await generateCoverLetter(job.id);
                      setCoverLetterText(letter);
                      toast.success("Cover letter generated");
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : "Generation failed");
                    }
                    setGenerating(false);
                  }}
                  disabled={generating || isPending}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                  {coverLetterText ? "Regenerate" : "Generate"}
                </Button>
              </div>
            </div>

            {coverLetterText ? (
              <>
                <Textarea
                  value={coverLetterText}
                  onChange={(e) => setCoverLetterText(e.target.value)}
                  rows={12}
                  className="text-sm leading-relaxed"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await saveCoverLetter(job.id, coverLetterText);
                          toast.success("Cover letter saved");
                        } catch {
                          toast.error("Failed to save");
                        }
                      });
                    }}
                    disabled={isPending}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    Save Edits
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Sparkles className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Click Generate to create a personalized cover letter using AI.</p>
                <p className="text-xs text-slate-400 mt-1">Uses your resume content and settings for tone/language.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100/80 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Notes</h3>
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

        <TabsContent value="activity" className="mt-4">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Activity Timeline</h3>
            <ActivityTimeline activities={job.activities} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-500 min-w-[60px]">{label}:</span>
      <span className="text-slate-700 font-medium">{value}</span>
    </div>
  );
}
