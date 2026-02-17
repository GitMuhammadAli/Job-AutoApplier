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
import { Card } from "@/components/ui/card";
import { STAGES, STAGE_CONFIG, PLATFORMS } from "@/lib/utils";
import { createJob, updateJob } from "@/app/actions/job";
import type { Job, Resume } from "@/types";
import { Loader2 } from "lucide-react";

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
      <Card className="p-6 rounded-xl border-0 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Company */}
          <div className="space-y-2">
            <Label htmlFor="company">Company *</Label>
            <Input
              id="company"
              value={form.company}
              onChange={(e) => update("company", e.target.value)}
              placeholder="e.g. Google"
              required
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Input
              id="role"
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              placeholder="e.g. Full-Stack Developer"
              required
            />
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="url">Job URL</Label>
            <Input
              id="url"
              type="url"
              value={form.url}
              onChange={(e) => update("url", e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* Platform */}
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={form.platform} onValueChange={(v) => update("platform", v)}>
              <SelectTrigger>
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

          {/* Stage */}
          <div className="space-y-2">
            <Label>Stage</Label>
            <Select value={form.stage} onValueChange={(v) => update("stage", v)}>
              <SelectTrigger>
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

          {/* Work Type */}
          <div className="space-y-2">
            <Label>Work Type</Label>
            <Select value={form.workType} onValueChange={(v) => update("workType", v)}>
              <SelectTrigger>
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

          {/* Resume */}
          <div className="space-y-2">
            <Label>Resume Variant</Label>
            <Select value={form.resumeId} onValueChange={(v) => update("resumeId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select resume..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {resumes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Salary */}
          <div className="space-y-2">
            <Label htmlFor="salary">Salary</Label>
            <Input
              id="salary"
              value={form.salary}
              onChange={(e) => update("salary", e.target.value)}
              placeholder="e.g. 80k-120k PKR"
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="e.g. Lahore"
            />
          </div>

          {/* Applied Date */}
          <div className="space-y-2">
            <Label htmlFor="appliedDate">Applied Date</Label>
            <Input
              id="appliedDate"
              type="date"
              value={form.appliedDate}
              onChange={(e) => update("appliedDate", e.target.value)}
            />
          </div>

          {/* Contact Name */}
          <div className="space-y-2">
            <Label htmlFor="contactName">Contact Name</Label>
            <Input
              id="contactName"
              value={form.contactName}
              onChange={(e) => update("contactName", e.target.value)}
              placeholder="e.g. HR Manager"
            />
          </div>

          {/* Contact Email */}
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={form.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
              placeholder="hr@company.com"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Any notes about this application..."
            rows={4}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Add Job" : "Save Changes"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
