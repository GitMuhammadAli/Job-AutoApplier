"use client";

import { Button } from "@/components/ui/button";
import { Copy, FileText, Mail, Type } from "lucide-react";
import { toast } from "sonner";

interface CopyApplicationBundleProps {
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  emailBody: string;
  coverLetter?: string | null;
  resumeName?: string | null;
  variant?: "full" | "compact";
}

export function CopyApplicationBundle({
  senderEmail,
  recipientEmail,
  subject,
  emailBody,
  coverLetter,
  resumeName,
  variant = "full",
}: CopyApplicationBundleProps) {
  const fullBundle = `FROM: ${senderEmail}
TO: ${recipientEmail}
SUBJECT: ${subject}
--- EMAIL BODY ---
${emailBody}
--- COVER LETTER ---
${coverLetter ?? "(none)"}
--- RESUME: ${resumeName ?? "none"} ---`;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  };

  const copyAll = () => copyToClipboard(fullBundle);

  const copySubject = () => copyToClipboard(subject);
  const copyBody = () => copyToClipboard(emailBody);
  const copyCoverLetter = () => copyToClipboard(coverLetter ?? "");

  if (variant === "compact") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={copyAll}
        className="gap-1.5"
      >
        <Copy className="h-3.5 w-3.5" />
        Copy All
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={copyAll}
        className="gap-1.5"
      >
        <Copy className="h-3.5 w-3.5" />
        Copy All
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={copySubject}
        className="gap-1.5 h-8 text-xs"
        title="Copy subject"
      >
        <Mail className="h-3 w-3" />
        Copy Subject
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={copyBody}
        className="gap-1.5 h-8 text-xs"
        title="Copy body"
      >
        <Type className="h-3 w-3" />
        Copy Body
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={copyCoverLetter}
        className="gap-1.5 h-8 text-xs"
        title="Copy cover letter"
        disabled={!coverLetter}
      >
        <FileText className="h-3 w-3" />
        Copy Cover Letter
      </Button>
    </div>
  );
}
