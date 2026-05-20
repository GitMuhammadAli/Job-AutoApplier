import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JobPilot — Apply to 50 jobs in 30 minutes",
  description:
    "JobPilot scans 9 job sites, scores every role against your resume, drafts a personal email in your voice, and sends it from your Gmail. Open-source, free forever.",
  keywords:
    "job search, job applications, job board, remote jobs, ATS resume, automated applications, Pakistan jobs",
  openGraph: {
    title: "JobPilot — Apply to 50 jobs in 30 minutes",
    description:
      "Scans 9 job sites. Scores against your resume. Drafts in your voice. Sends from your Gmail. All in one tab.",
    type: "website",
    url: "https://jobpilot.pk",
  },
  twitter: {
    card: "summary_large_image",
    title: "JobPilot — Apply to 50 jobs in 30 minutes",
    description: "9 sources · 16 templates · 4-agent pipeline. Sent from your Gmail.",
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
