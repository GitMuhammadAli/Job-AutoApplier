"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="mx-auto max-w-md space-y-4 text-center px-4">
          <h2 className="text-2xl font-bold">Something went wrong</h2>
          <p className="text-zinc-400 text-sm">
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p className="text-xs text-zinc-500">Error ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
