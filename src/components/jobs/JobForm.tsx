"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAGES, STAGE_CONFIG, PLATFORMS } from "@/lib/utils";
import { createJob, updateJob } from "@/app/actions/job";
import type { Job, Resume } from "@/types";
import { Loader2, Building2, Briefcase, Link as LinkIcon, MapPin, DollarSign, User, Mail, Calendar } from "lucide-react";

const PLATFORM_LABELS: Record<string, string> = {
  LINKEDIN: "LinkedIn",
  INDEED: "Indeed",
  GLASSDOOR: "Glassdoor",
  ROZEE_PK: "Rozee.pk",
  BAYT: "Bayt",
  COMPANY_SITE: "Company Site",
  REFERRAL: "Referral",
  OTHER: "Other",
};

const WORK_TYPES = [
  { value: "ONSITE", label: "On-site" },
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
];

interface JobFormProps {
  job?: Job;
  resumes: Resume[];
  mode: "create" | "edit";
}

export function JobForm({ job, resumes, mode }: JobFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    company: job?.company ?? "",
    role: job?.role ?? "",
    url: job?.url ?? "",
    platform: job?.platform ?? "LINKEDIN",
    stage: job?.stage ?? "SAVED",
    salary: job?.salary ?? "",
    location: job?.location ?? "",
    workType: job?.workType ?? "ONSITE",
    resumeId: job?.resumeId ?? "",
    notes: job?.notes ?? "",
    contactName: job?.contactName ?? "",
    contactEmail: job?.contactEmail ?? "",
    appliedDate: job?.appliedDate ? job.appliedDate.split("T")[0] : "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        if (mode === "create") {
          const result = await createJob(form as any);
          toast.success("Job added successfully");
          router.push("/");
        } else if (job) {
          await updateJob(job.id, form as any);
          toast.success("Job updated");
          router.push(`/jobs/${job.id}`);
        }
      } catch (err: any) {
        toast.error(err.message || "Something went wrong");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="relative overflow-hidden rounded-xl bg-white p-5 md:p-6 shadow-sm ring-1 ring-slate-200/60 space-y-6">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-500 to-violet-500" />

        {/* Essential info */}
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Essential Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="company" className="text-xs flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-slate-400" />
                Company *
              </Label>
              <Input
                id="company"
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
                placeholder="e.g. Google"
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-xs flex items-center gap-1.5">
                <Briefcase className="h-3 w-3 text-slate-400" />
                Role *
              </Label>
              <Input
                id="role"
                value={form.role}
                onChange={(e) => update("role", e.target.value)}
                placeholder="e.g. Full-Stack Developer"
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url" className="text-xs flex items-center gap-1.5">
                <LinkIcon className="h-3 w-3 text-slate-400" />
                Job URL
              </Label>
              <Input
                id="url"
                type="url"
                value={form.url}
                onChange={(e) => update("url", e.target.value)}
                placeholder="https://..."
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Platform</Label>
              <Select value={form.platform} onValueChange={(v) => update("platform", v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PLATFORM_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Status & details */}
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Status & Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Stage</Label>
              <Select value={form.stage} onValueChange={(v) => update("stage", v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAGE_CONFIG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Work Type</Label>
              <Select value={form.workType} onValueChange={(v) => update("workType", v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_TYPES.map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Resume Variant</Label>
              <Select value={form.resumeId || undefined} onValueChange={(v) => update("resumeId", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select resume..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {resumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salary" className="text-xs flex items-center gap-1.5">
                <DollarSign className="h-3 w-3 text-slate-400" />
                Salary
              </Label>
              <Input
                id="salary"
                value={form.salary}
                onChange={(e) => update("salary", e.target.value)}
                placeholder="e.g. 80k-120k PKR"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-xs flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-slate-400" />
                Location
              </Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="e.g. Lahore"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appliedDate" className="text-xs flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-slate-400" />
                Applied Date
              </Label>
              <Input
                id="appliedDate"
                type="date"
                value={form.appliedDate}
                onChange={(e) => update("appliedDate", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Contact */}
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contactName" className="text-xs flex items-center gap-1.5">
                <User className="h-3 w-3 text-slate-400" />
                Contact Name
              </Label>
              <Input
                id="contactName"
                value={form.contactName}
                onChange={(e) => update("contactName", e.target.value)}
                placeholder="e.g. HR Manager"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactEmail" className="text-xs flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-slate-400" />
                Contact Email
              </Label>
              <Input
                id="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                placeholder="hr@company.com"
                className="h-9"
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Any notes about this application..."
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="px-5"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} className="px-5 shadow-md">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Add Job" : "Save Changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
