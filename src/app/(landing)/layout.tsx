import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JobPilot — AI-Powered Job Application Platform",
  description:
    "Stop applying blindly. JobPilot matches jobs to your skills, writes personalized emails, and tracks every application. Free for developers and global job seekers.",
  keywords:
    "job search, AI applications, job board, Pakistan jobs, remote jobs, React developer jobs, automated job applications",
  openGraph: {
    title: "JobPilot — Land Interviews, Not Rejections",
    description:
      "AI-powered job matching, personalized email generation, and application tracking. 8+ job sources. Free.",
    type: "website",
    url: "https://jobpilot.pk",
  },
  twitter: {
    card: "summary_large_image",
    title: "JobPilot — AI Job Application Platform",
    description: "Match → Write → Send → Track. All automated.",
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
