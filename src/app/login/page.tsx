import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4 relative overflow-hidden">
          <div className="relative w-full max-w-sm space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center gap-2.5">
                <span className="text-2xl">🚀</span>
                <div className="h-7 w-28 rounded bg-stone-200 dark:bg-stone-800 animate-pulse-soft" />
              </div>
              <div className="h-3 w-40 rounded bg-stone-200/70 dark:bg-stone-800/70 animate-pulse-soft mx-auto" />
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-stone-900/95 p-6 sm:p-7 shadow-soft-xl ring-1 ring-stone-200/70 dark:ring-stone-800/60">
              <div className="h-5 w-24 rounded bg-stone-200 dark:bg-stone-800 animate-pulse-soft mb-2" />
              <div className="h-3 w-56 rounded bg-stone-200/70 dark:bg-stone-800/70 animate-pulse-soft mb-5" />
              <div className="space-y-2.5">
                <div className="h-11 rounded-lg bg-stone-100 dark:bg-stone-800/60 animate-pulse-soft" />
                <div className="h-11 rounded-lg bg-stone-200/80 dark:bg-stone-800 animate-pulse-soft" />
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
