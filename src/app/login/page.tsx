"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Mail, Loader2, AlertCircle } from "lucide-react";

const AUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "This email is already linked to a different sign-in method.",
  OAuthSignin: "Could not start the sign-in flow. Please try again.",
  OAuthCallback: "Authentication was rejected. Please try again.",
  AccessDenied: "Access denied. You may not have permission to sign in.",
  Verification: "The sign-in link has expired. Please request a new one.",
  Default: "An authentication error occurred. Please try again.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
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
  );
}

function LoginContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const errorParam = searchParams.get("error");
  const authError = errorParam ? (AUTH_ERRORS[errorParam] || AUTH_ERRORS.Default) : null;

  useEffect(() => {
    if (status === "authenticated" && session) {
      router.replace("/");
    }
  }, [status, session, router]);

  const handleOAuth = (provider: string) => {
    setLoading(provider);
    signIn(provider, { callbackUrl: "/" });
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading("email");
    await signIn("email", { email, redirect: false });
    setEmailSent(true);
    setLoading(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-blue-600/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">JobPilot</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Automated job tracker with smart matching
          </p>
        </div>

        {/* Card */}
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 p-6 shadow-xl ring-1 ring-slate-200/60 dark:ring-zinc-700/60">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500" />

          <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-4">Sign in to your account</h2>

          {authError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 ring-1 ring-red-200 dark:ring-red-800/50">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300">{authError}</p>
            </div>
          )}

          {/* OAuth buttons */}
          <div className="space-y-2.5">
            <Button
              variant="outline"
              className="w-full h-10 text-sm font-medium justify-center gap-2.5"
              onClick={() => handleOAuth("google")}
              disabled={loading !== null}
            >
              {loading === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Continue with Google
            </Button>

            <Button
              variant="outline"
              className="w-full h-10 text-sm font-medium justify-center gap-2.5"
              onClick={() => handleOAuth("github")}
              disabled={loading !== null}
            >
              {loading === "github" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              )}
              Continue with GitHub
            </Button>
          </div>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white dark:bg-zinc-800 px-3 text-slate-400 dark:text-zinc-500 font-medium">or sign in with email</span>
            </div>
          </div>

          {/* Email magic link */}
          {emailSent ? (
            <div className="rounded-xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-100">
              <Mail className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-emerald-700">Check your inbox</p>
              <p className="text-xs text-emerald-600 mt-1">
                We sent a sign-in link to <strong>{email}</strong>
              </p>
              <button
                onClick={() => { setEmailSent(false); setEmail(""); }}
                className="mt-3 text-xs text-emerald-600 underline hover:text-emerald-700"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmail} className="space-y-2.5">
              <label htmlFor="login-email" className="sr-only">Email address</label>
              <Input
                id="login-email"
                type="email"
                name="email"
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com..."
                required
                className="h-10"
              />
              <Button
                type="submit"
                className="w-full h-10 text-sm font-medium"
                disabled={loading !== null || !email.trim()}
              >
                {loading === "email" ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-1.5" />
                )}
                Send Magic Link
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 dark:text-zinc-500">
          By signing in, you agree to let JobPilot scrape jobs and send email notifications on your behalf.
        </p>
      </div>
    </div>
  );
}
