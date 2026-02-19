import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center px-4">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2.5">
                <div className="h-11 w-11 rounded-xl bg-slate-200 dark:bg-zinc-700 animate-pulse" />
                <div className="h-7 w-28 rounded bg-slate-200 dark:bg-zinc-700 animate-pulse" />
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-zinc-800 p-6 shadow-xl ring-1 ring-slate-200/60 dark:ring-zinc-700/60">
              <div className="h-6 w-48 rounded bg-slate-200 dark:bg-zinc-700 animate-pulse mb-4" />
              <div className="space-y-2.5">
                <div className="h-10 rounded-lg bg-slate-200 dark:bg-zinc-700 animate-pulse" />
                <div className="h-10 rounded-lg bg-slate-200 dark:bg-zinc-700 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
