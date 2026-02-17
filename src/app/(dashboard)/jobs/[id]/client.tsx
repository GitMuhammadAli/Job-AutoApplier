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
import type { Job, Resume, Stage } from "@/types";
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

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-slide-up">
      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to pipeline
      </Link>

      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${config.gradient}`} />

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Building2 className="h-4 w-4" />
              {job.company}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">{job.role}</h1>
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
          <div className="flex gap-2">
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
              <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={job.contactEmail || "Not specified"} />
              <InfoRow icon={<Send className="h-3.5 w-3.5" />} label="Applied" value={job.appliedDate ? new Date(job.appliedDate).toLocaleDateString() : "Not yet"} />
              <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Follow-up" value={job.followUpDate ? new Date(job.followUpDate).toLocaleDateString() : "Not set"} />
            </div>
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
