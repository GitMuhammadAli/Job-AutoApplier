import { getEmailTemplates, seedStarterTemplates } from "@/app/actions/email-template";
import { TemplateEditor } from "@/components/templates/TemplateEditor";
import { Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  let templates: Awaited<ReturnType<typeof getEmailTemplates>> = [];

  try {
    templates = await getEmailTemplates();

    if (templates.length === 0) {
      await seedStarterTemplates();
      templates = await getEmailTemplates();
    }
  } catch (error) {
    console.error("[TemplatesPage] Failed to load templates:", error);
  }

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
      <TemplateEditor templates={templates} />
    </div>
  );
}
