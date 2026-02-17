"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";

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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Building2 className="h-4 w-4" />
            {job.company}
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mt-1">{job.role}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge className={`${config.bg} ${config.text} border-0`}>
              {config.label}
            </Badge>
            <PlatformBadge platform={job.platform} />
            <ResumeBadge resume={job.resumeUsed} />
            {days !== null && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {days === 0 ? "Applied today" : `${days}d ago`}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {job.url && (
            <Button variant="outline" size="sm" asChild>
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                View Job
              </a>
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
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

      {/* Stage quick buttons */}
      <Card className="p-4 rounded-xl border-0 shadow-sm">
        <p className="text-xs text-slate-500 mb-2 font-medium">Move to stage:</p>
        <div className="flex flex-wrap gap-2">
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
                className={isCurrent ? "" : `${sc.text} hover:${sc.bg}`}
              >
                <div className={`h-2 w-2 rounded-full ${sc.dot} mr-1.5`} />
                {sc.label}
              </Button>
            );
          })}
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="edit">
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity ({job.activities?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 rounded-xl border-0 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Job Info</h3>
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={job.location || "Not specified"} />
              <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Salary" value={job.salary || "Not specified"} />
              <InfoRow icon={<Building2 className="h-4 w-4" />} label="Work Type" value={job.workType} />
              {job.url && (
                <InfoRow
                  icon={<ExternalLink className="h-4 w-4" />}
                  label="URL"
                  value={
                    <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[200px] inline-block">
                      {new URL(job.url).hostname}
                    </a>
                  }
                />
              )}
            </Card>

            <Card className="p-4 rounded-xl border-0 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Contact</h3>
              <InfoRow icon={<User className="h-4 w-4" />} label="Name" value={job.contactName || "Not specified"} />
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={job.contactEmail || "Not specified"} />
              <h3 className="text-sm font-semibold text-slate-700 pt-2">Dates</h3>
              <InfoRow icon={<Send className="h-4 w-4" />} label="Applied" value={job.appliedDate ? new Date(job.appliedDate).toLocaleDateString() : "Not yet"} />
              <InfoRow icon={<Clock className="h-4 w-4" />} label="Follow-up" value={job.followUpDate ? new Date(job.followUpDate).toLocaleDateString() : "Not set"} />
            </Card>
          </div>

          {/* Notes */}
          {job.notes && (
            <Card className="p-4 rounded-xl border-0 shadow-sm mt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Notes</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{job.notes}</p>
            </Card>
          )}

          {/* Add Note */}
          <Card className="p-4 rounded-xl border-0 shadow-sm mt-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Add Note</h3>
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a note..."
              rows={3}
            />
            <Button size="sm" onClick={handleAddNote} disabled={isPending || !newNote.trim()}>
              {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Add Note
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="edit" className="mt-4">
          <JobForm job={job} resumes={resumes} mode="edit" />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card className="p-4 rounded-xl border-0 shadow-sm">
            <ActivityTimeline activities={job.activities ?? []} />
          </Card>
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
      <span className="text-slate-500 w-20">{label}</span>
      <span className="text-slate-700 font-medium">{value}</span>
    </div>
  );
}
