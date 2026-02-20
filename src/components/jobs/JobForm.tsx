"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createManualJob } from "@/app/actions/job";
import { Loader2, Building2, Briefcase, Link as LinkIcon, MapPin, DollarSign } from "lucide-react";

export function JobForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    if (!title.trim() || !company.trim()) {
      toast.error("Title and company are required");
      return;
    }

    startTransition(async () => {
      try {
        await createManualJob({
          title: title.trim(),
          company: company.trim(),
          location: location.trim() || undefined,
          salary: salary.trim() || undefined,
          applyUrl: applyUrl.trim() || undefined,
          description: description.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        toast.success("Job added successfully");
        router.push("/dashboard");
      } catch {
        toast.error("Failed to add job");
      }
    });
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl bg-white dark:bg-zinc-800/80 p-5 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700/60 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <Briefcase className="h-3 w-3" /> Job Title *
            </Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Full Stack Developer" />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <Building2 className="h-3 w-3" /> Company *
            </Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="TechCorp" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Location
            </Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lahore, Pakistan" />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <DollarSign className="h-3 w-3" /> Salary
            </Label>
            <Input value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="$50k-$80k" />
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
            <LinkIcon className="h-3 w-3" /> Apply URL
          </Label>
          <Input value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="https://careers.example.com/apply" />
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">Job Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Paste the job description..." rows={4} />
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about this job..." rows={2} />
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Add Job
        </Button>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
