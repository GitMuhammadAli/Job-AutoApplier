"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { ASMark } from "@/components/ui/as-mark";
import { GENERIC } from "@/lib/messages";

const AUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email is already linked to a different sign-in method.",
  OAuthSignin: "Could not start the sign-in flow. Please try again.",
  OAuthCallback: "Authentication was rejected. Please try again.",
  AccessDenied: "Access denied. You may not have permission to sign in.",
  Verification: "The sign-in link has expired. Please request a new one.",
  Default: "An authentication error occurred. Please try again.",
};

export function LoginForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const errorParam = searchParams.get("error");
  const authError = errorParam
    ? AUTH_ERRORS[errorParam] || AUTH_ERRORS.Default
    : null;

  useEffect(() => {
    if (status === "authenticated" && session) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const handleOAuth = (provider: string) => {
    setLoading(provider);
    signIn(provider, { callbackUrl: "/dashboard" });
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading("email");
    const result = await signIn("email", { email, redirect: false });
    setLoading(null);
    if (result?.ok && !result?.error) {
      setEmailSent(true);
    } else if (result?.error) {
      const msg = AUTH_ERRORS[result.error] || AUTH_ERRORS.Default;
      toast.error(msg);
    } else {
      toast.error(GENERIC.SOMETHING_WENT_WRONG_GENERIC);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Atmospheric wash — desaturated emerald orbs over warm stone */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="pointer-events-none absolute top-[18%] -right-32 h-[420px] w-[420px] rounded-full bg-emerald-500/[0.08] dark:bg-emerald-500/[0.05] blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[12%] -left-24 h-[340px] w-[340px] rounded-full bg-amber-300/[0.10] dark:bg-amber-300/[0.05] blur-[120px]" />

      <div className="relative w-full max-w-sm space-y-8 animate-page-enter">
        <div className="text-center space-y-2">
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2.5 group"
          >
            <span className="text-2xl transition-transform group-hover:-translate-y-0.5 group-hover:rotate-[-4deg] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
              🚀
            </span>
            <span className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              JobPilot
            </span>
          </a>
          <p className="text-[13px] leading-relaxed text-stone-500 dark:text-stone-400">
            Pick up where you left off.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm p-6 sm:p-7 shadow-soft-xl ring-1 ring-stone-200/70 dark:ring-stone-800/60">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

          <h2 className="text-[17px] font-medium text-stone-900 dark:text-stone-100 mb-1">
            Sign in
          </h2>
          <p className="text-[12px] text-stone-500 dark:text-stone-400 mb-5">
            Magic link or one of the providers below.
          </p>

          {authError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 p-3 ring-1 ring-rose-200/60 dark:ring-rose-900/50"
            >
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
              <p className="text-[12px] leading-relaxed text-rose-700 dark:text-rose-300">
                {authError}
              </p>
            </div>
          )}

          {emailSent ? (
            <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 p-5 text-center ring-1 ring-emerald-200/60 dark:ring-emerald-900/50 animate-in fade-in zoom-in-95 duration-300">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400 mx-auto mb-2.5" />
              <p className="text-[14px] font-medium text-emerald-800 dark:text-emerald-200">
                Check your inbox
              </p>
              <p className="text-[12px] leading-relaxed text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                We sent a sign-in link to{" "}
                <span className="font-medium text-emerald-900 dark:text-emerald-100">
                  {email}
                </span>
              </p>
              <button
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                }}
                className="mt-4 text-[12px] font-medium text-emerald-700 dark:text-emerald-300 underline-offset-2 hover:underline focus-soft tap-44"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleEmail} className="space-y-2.5">
                <label htmlFor="login-email" className="sr-only">
                  Email address
                </label>
                <Input
                  id="login-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-11 text-[14px] bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-0 placeholder:text-stone-400"
                />
                <Button
                  type="submit"
                  className="w-full h-11 text-[14px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-soft-md hover:shadow-soft-lg transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-soft"
                  disabled={loading !== null || !email.trim()}
                >
                  {loading === "email" ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-1.5" />
                  )}
                  Send magic link
                </Button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200 dark:border-stone-800" />
                </div>
                <div className="relative flex justify-center text-[11px]">
                  <span className="bg-white/95 dark:bg-stone-900/95 px-3 text-stone-400 dark:text-stone-500 font-medium uppercase tracking-wider">
                    or
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <Button
                  variant="outline"
                  className="w-full h-11 text-[14px] font-medium justify-center gap-2.5 border-stone-200 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/60 transition-colors duration-300 focus-soft"
                  onClick={() => handleOAuth("google")}
                  disabled={loading !== null}
                >
                  {loading === "google" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  )}
                  Continue with Google
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-11 text-[14px] font-medium justify-center gap-2.5 border-stone-200 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/60 transition-colors duration-300 focus-soft"
                  onClick={() => handleOAuth("github")}
                  disabled={loading !== null}
                >
                  {loading === "github" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                  )}
                  Continue with GitHub
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="space-y-3 text-center">
          <p className="text-[11px] leading-relaxed text-stone-400 dark:text-stone-500 max-w-[18rem] mx-auto">
            By signing in you agree to JobPilot's{" "}
            <a href="/terms" className="underline underline-offset-2 hover:text-stone-600 dark:hover:text-stone-300">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline underline-offset-2 hover:text-stone-600 dark:hover:text-stone-300">
              Privacy
            </a>
            .
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors duration-300 focus-soft tap-44"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to homepage
          </a>
        </div>

        <a
          href="https://alishahid-dev.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 pt-4 opacity-50 hover:opacity-100 transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <ASMark size={20} />
          <span className="text-[10px] text-stone-400 dark:text-stone-500 tracking-wide">
            by Ali Shahid
          </span>
        </a>
      </div>
    </div>
  );
}
