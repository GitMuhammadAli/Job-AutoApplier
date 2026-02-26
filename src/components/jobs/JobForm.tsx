"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createManualJob } from "@/app/actions/job";
import {
  Loader2,
  Building2,
  Briefcase,
  Link as LinkIcon,
  MapPin,
  DollarSign,
  Sparkles,
  Globe,
  Mail,
} from "lucide-react";

export function JobForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isExtracting, setIsExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);

  // Support share target params (?shared_url=...)
  const sharedUrl = searchParams.get("shared_url") || searchParams.get("url") || "";
  const sharedText = searchParams.get("shared_text") || searchParams.get("text") || "";

  const [pasteUrl, setPasteUrl] = useState(sharedUrl);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [applyUrl, setApplyUrl] = useState(sharedUrl);
  const [description, setDescription] = useState(sharedText);
  const [companyEmail, setCompanyEmail] = useState("");
  const [notes, setNotes] = useState("");

  async function handleExtractUrl() {
    const url = pasteUrl.trim();
    if (!url) {
      toast.error("Paste a URL first");
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsExtracting(true);
    try {
      const res = await fetch("/api/jobs/extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to extract job details");
        return;
      }

      // Auto-fill the form with extracted data
      if (data.title) setTitle(data.title);
      if (data.company) setCompany(data.company);
      if (data.location) setLocation(data.location);
      if (data.salary) setSalary(data.salary);
      if (data.email) setCompanyEmail(data.email);
      if (data.description) setDescription(data.description);
      setApplyUrl(data.applyUrl || url);
      setExtracted(true);

      const filled = [data.title, data.company, data.location].filter(Boolean).length;
      toast.success(`Extracted ${filled} fields from URL`);
    } catch {
      toast.error("Failed to fetch URL, check the link and try again");
    } finally {
      setIsExtracting(false);
    }
  }

  const handleSubmit = () => {
    if (!title.trim() || !company.trim()) {
      toast.error("Title and company are required");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createManualJob({
          title: title.trim(),
          company: company.trim(),
          location: location.trim() || undefined,
          salary: salary.trim() || undefined,
          applyUrl: applyUrl.trim() || undefined,
          description: description.trim() || undefined,
          notes: notes.trim() || undefined,
          companyEmail: companyEmail.trim() || undefined,
        });
        if (!result.success) {
          toast.error(result.error || "Failed to add job");
          return;
        }
        toast.success("Job added successfully");
        router.push("/dashboard");
      } catch {
        toast.error("Failed to add job");
      }
    });
  };

  return (
    <div className="max-w-2xl space-y-5">
      {/* URL Quick Extract */}
      <div className="rounded-xl bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 p-4 ring-1 ring-blue-200/50 dark:ring-blue-800/40 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
            Quick Add from URL
          </p>
        </div>
        <p className="text-xs text-blue-600/80 dark:text-blue-400/70">
          Paste a job URL from LinkedIn, Indeed, or any career page. We&apos;ll extract the details automatically.
        </p>
        <div className="flex gap-2">
          <Input
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            placeholder="https://linkedin.com/jobs/view/... or any job URL"
            className="flex-1 bg-white dark:bg-zinc-800"
            onKeyDown={(e) => e.key === "Enter" && handleExtractUrl()}
          />
          <Button
            onClick={handleExtractUrl}
            disabled={isExtracting || !pasteUrl.trim()}
            size="sm"
            className="shrink-0 gap-1.5"
          >
            {isExtracting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {isExtracting ? "Extracting..." : "Extract"}
          </Button>
        </div>
        {extracted && (
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            Fields auto-filled. Review and edit below, then click Add Job.
          </p>
        )}
      </div>

      {/* Manual Form */}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <LinkIcon className="h-3 w-3" /> Apply URL
            </Label>
            <Input value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="https://careers.example.com/apply" />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> Company Email
            </Label>
            <Input value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="hr@company.com" />
          </div>
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
