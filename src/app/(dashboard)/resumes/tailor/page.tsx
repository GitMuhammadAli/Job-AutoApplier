import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { TailorClient } from "./client";

interface PageProps {
  searchParams: {
    jd?: string;
  };
}

export default function ResumeTailorPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-4 animate-slide-up">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-md shadow-emerald-600/20">
            <Sparkles size={16} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Tailor your resume for this job
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Paste the JD, pick a template, get an ATS-matched PDF using your own
          profile content. No fabrication — every word traces back to you.
        </p>
      </header>

      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />}>
        <TailorClient initialJd={searchParams.jd ?? ""} />
      </Suspense>
    </div>
  );
}
