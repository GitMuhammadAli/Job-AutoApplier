import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { TailorClient } from "./client";

interface PageProps {
  searchParams: {
    jd?: string;
    tab?: string;
  };
}

const VALID_TABS = ["new", "history", "variants"] as const;
type WorkshopTab = (typeof VALID_TABS)[number];

export default function ResumeTailorPage({ searchParams }: PageProps) {
  const queryTab = searchParams.tab;
  const initialTab: WorkshopTab =
    queryTab && (VALID_TABS as readonly string[]).includes(queryTab)
      ? (queryTab as WorkshopTab)
      : "new";

  return (
    <div className="space-y-4 animate-slide-up">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-md shadow-emerald-600/20">
            <Sparkles size={16} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Resume workshop
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Paste a JD, pick a template, get an ATS-matched PDF — and browse every
          past generation. Source materials live under{" "}
          <a href="/resumes" className="underline underline-offset-2 hover:text-emerald-600 dark:hover:text-emerald-400">
            Resumes
          </a>
          .
        </p>
      </header>

      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />}>
        <TailorClient initialJd={searchParams.jd ?? ""} initialTab={initialTab} />
      </Suspense>
    </div>
  );
}
