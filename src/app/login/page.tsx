import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center px-4">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2.5">
                <div className="text-2xl">🚀</div>
                <div className="h-7 w-28 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl ring-1 ring-zinc-200/60 dark:ring-zinc-800/60">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
              <div className="h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse mb-4" />
              <div className="space-y-2.5">
                <div className="h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                <div className="h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
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
