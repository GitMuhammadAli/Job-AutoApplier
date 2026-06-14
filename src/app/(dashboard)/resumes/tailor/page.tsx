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
    <div className="space-y-6 animate-page-enter">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500 mb-1">
          Resume
        </p>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 ring-1 ring-emerald-200/50 dark:ring-emerald-900/40">
            <Sparkles size={16} className="text-emerald-700 dark:text-emerald-300" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Workshop
          </h1>
        </div>
        <p className="mt-1.5 text-[13px] sm:text-sm leading-relaxed text-stone-500 dark:text-stone-400 max-w-prose">
          Paste a JD, pick a template, ship an ATS-matched PDF. Source materials live under{" "}
          <a href="/resumes" className="underline underline-offset-2 decoration-stone-300 dark:decoration-stone-700 hover:decoration-emerald-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors duration-300">
            Resumes
          </a>
          .
        </p>
      </header>

      <Suspense
        fallback={
          <div className="h-96 animate-pulse-soft rounded-2xl bg-stone-200/60 dark:bg-stone-800/60 shadow-soft-sm" />
        }
      >
        <TailorClient initialJd={searchParams.jd ?? ""} initialTab={initialTab} />
      </Suspense>
    </div>
  );
}
