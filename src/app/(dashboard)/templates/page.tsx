import { Suspense } from "react";
import { getEmailTemplates, seedStarterTemplates } from "@/app/actions/email-template";
import { Mail, Loader2 } from "lucide-react";
import nextDynamic from "next/dynamic";

const TemplateEditor = nextDynamic(
  () => import("@/components/templates/TemplateEditor").then((m) => m.TemplateEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    ),
  },
);

export default function TemplatesPage() {
  return (
    <div className="space-y-5 animate-slide-up">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 shadow-md shadow-slate-600/20">
            <Mail className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Email Templates</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Manage your application email templates. Use placeholders like {"{{company}}"}, {"{{position}}"}, {"{{name}}"} for personalization.
        </p>
      </div>
      <Suspense fallback={
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-700/70 h-32" />
          ))}
        </div>
      }>
        <TemplatesContent />
      </Suspense>
    </div>
  );
}

async function TemplatesContent() {
  let templates: Awaited<ReturnType<typeof getEmailTemplates>> = [];
  let loadError = false;

  try {
    templates = await getEmailTemplates();

    if (templates.length === 0) {
      await seedStarterTemplates();
      templates = await getEmailTemplates();
    }
  } catch (error) {
    console.error("[TemplatesPage] Failed to load templates:", error);
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/30 p-6 text-center">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">Failed to load templates</p>
        <p className="mt-1 text-xs text-red-600/70 dark:text-red-400/60">Please refresh the page to try again.</p>
      </div>
    );
  }

  return <TemplateEditor templates={templates} />;
}
