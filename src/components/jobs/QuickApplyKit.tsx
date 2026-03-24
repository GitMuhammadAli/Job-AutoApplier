"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Copy,
  CheckCircle2,
  User,
  Mail,
  Phone,
  Linkedin,
  Globe,
  Github,
  Sparkles,
  Loader2,
  RefreshCw,
  GraduationCap,
} from "lucide-react";
import { useStreamingPitch } from "@/hooks/use-streaming-pitch";

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

interface QuickApplyKitProps {
  profile: ProfileData;
  jobId: string;
  jobTitle: string;
  company: string;
}

function CopyButton({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors bg-slate-50 dark:bg-zinc-800/60 hover:bg-blue-50 dark:hover:bg-blue-900/20 group ring-1 ring-slate-100 dark:ring-zinc-700/60"
    >
      <span className="text-slate-400 dark:text-zinc-500 shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[10px] font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
          {label}
        </span>
        <span className="block text-slate-700 dark:text-zinc-200 font-medium truncate">
          {value}
        </span>
      </span>
      {copied ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-slate-300 dark:text-zinc-600 group-hover:text-blue-500 shrink-0" />
      )}
    </button>
  );
}

export function QuickApplyKit({ profile, jobId, jobTitle, company }: QuickApplyKitProps) {
  const pitchStream = useStreamingPitch();
  const coverLetterStream = useStreamingPitch();

  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedCL, setCopiedCL] = useState(false);
  const [copiedBundle, setCopiedBundle] = useState(false);

  const hasProfile = profile.fullName || profile.applicationEmail;

  const pitch = pitchStream.text || null;
  const coverLetter = coverLetterStream.text || null;
  const generating = pitchStream.isStreaming || coverLetterStream.isStreaming;

  const generateContent = async () => {
    pitchStream.reset();
    coverLetterStream.reset();
    // Fire both streams in parallel
    await Promise.all([
      pitchStream.generate(jobId, "pitch"),
      coverLetterStream.generate(jobId, "cover_letter"),
    ]);
    if (!pitchStream.error && !coverLetterStream.error) {
      toast.success("Cover letter & pitch generated");
    } else {
      toast.error("Failed to generate — try again");
    }
  };

  const copyText = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const copyFullBundle = async () => {
    const parts = [
      profile.fullName,
      profile.applicationEmail,
      profile.phone,
      profile.linkedinUrl,
      profile.portfolioUrl || profile.githubUrl,
      [profile.experienceLevel, profile.city, profile.country].filter(Boolean).join(" | "),
    ].filter(Boolean);
    await copyText(parts.join(" | "), setCopiedBundle);
    toast.success("Details copied to clipboard");
  };

  if (!hasProfile) {
    return (
      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 ring-1 ring-amber-200 dark:ring-amber-800/40">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Set up your profile in Settings to use Quick Apply Kit.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white dark:bg-zinc-800 p-3 sm:p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          Quick Apply Kit
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={copyFullBundle}
          className="h-7 text-[10px] gap-1"
        >
          {copiedBundle ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          Copy All
        </Button>
      </div>

      <div className="space-y-1.5">
        {profile.fullName && (
          <CopyButton label="Full Name" value={profile.fullName} icon={<User className="h-3.5 w-3.5" />} />
        )}
        {profile.applicationEmail && (
          <CopyButton label="Email" value={profile.applicationEmail} icon={<Mail className="h-3.5 w-3.5" />} />
        )}
        {profile.phone && (
          <CopyButton label="Phone" value={profile.phone} icon={<Phone className="h-3.5 w-3.5" />} />
        )}
        {profile.linkedinUrl && (
          <CopyButton label="LinkedIn" value={profile.linkedinUrl} icon={<Linkedin className="h-3.5 w-3.5" />} />
        )}
        {profile.portfolioUrl && (
          <CopyButton label="Portfolio" value={profile.portfolioUrl} icon={<Globe className="h-3.5 w-3.5" />} />
        )}
        {profile.githubUrl && (
          <CopyButton label="GitHub" value={profile.githubUrl} icon={<Github className="h-3.5 w-3.5" />} />
        )}
      </div>

      {/* AI Content */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-700/60 space-y-2">
        {!pitch && !pitchStream.isStreaming && !coverLetter && !coverLetterStream.isStreaming && (
          <Button
            variant="outline"
            size="sm"
            onClick={generateContent}
            disabled={generating}
            className="w-full gap-1.5 text-xs"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {generating ? "Generating..." : "Generate Cover Letter & Pitch"}
          </Button>
        )}

        {(pitch || pitchStream.isStreaming) && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                Pitch (short)
                {pitchStream.isStreaming && <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-500" />}
              </span>
              {!pitchStream.isStreaming && pitch && (
                <button
                  type="button"
                  onClick={() => copyText(pitch, setCopiedPitch)}
                  className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                >
                  {copiedPitch ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedPitch ? "Copied" : "Copy"}
                </button>
              )}
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/60 p-2.5 text-xs text-slate-600 dark:text-zinc-300 leading-relaxed ring-1 ring-slate-100 dark:ring-zinc-700/60 max-h-24 overflow-y-auto">
              {pitchStream.text}
              {pitchStream.isStreaming && (
                <span className="inline-block w-0.5 h-3 bg-blue-500 animate-pulse ml-px align-middle" />
              )}
            </div>
          </div>
        )}

        {(coverLetter || coverLetterStream.isStreaming) && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                Cover Letter
                {coverLetterStream.isStreaming && <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-500" />}
              </span>
              {!coverLetterStream.isStreaming && coverLetter && (
                <button
                  type="button"
                  onClick={() => copyText(coverLetter, setCopiedCL)}
                  className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                >
                  {copiedCL ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedCL ? "Copied" : "Copy"}
                </button>
              )}
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/60 p-2.5 text-xs text-slate-600 dark:text-zinc-300 leading-relaxed ring-1 ring-slate-100 dark:ring-zinc-700/60 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {coverLetterStream.text}
              {coverLetterStream.isStreaming && (
                <span className="inline-block w-0.5 h-3 bg-blue-500 animate-pulse ml-px align-middle" />
              )}
            </div>
          </div>
        )}

        {(pitch || coverLetter) && !generating && (
          <Button
            variant="ghost"
            size="sm"
            onClick={generateContent}
            disabled={generating}
            className="w-full gap-1.5 text-[10px] h-7"
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate
          </Button>
        )}

        {/* Cross-product: Prepare for Interview on DevRadar */}
        {process.env.NEXT_PUBLIC_DEVRADAR_URL && (
          <a
            href={`${process.env.NEXT_PUBLIC_DEVRADAR_URL}/interview?source=jobpilot&title=${encodeURIComponent(jobTitle)}&company=${encodeURIComponent(company)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full rounded-lg px-3 py-2 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors ring-1 ring-violet-200 dark:ring-violet-800/40"
          >
            <GraduationCap className="h-3.5 w-3.5" />
            Prepare for Interview on DevRadar
          </a>
        )}
      </div>
    </div>
  );
}
