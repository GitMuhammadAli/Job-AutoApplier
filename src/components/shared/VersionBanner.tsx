"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

const POLL_INTERVAL_MS = 60_000;

export function VersionBanner() {
  const initialBuildId = useRef<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkVersion() {
      try {
        const res = await fetch(`/api/version?_t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const { buildId } = await res.json();
        if (!mounted || !buildId || buildId === "unknown") return;

        if (initialBuildId.current === null) {
          initialBuildId.current = buildId;
        } else if (buildId !== initialBuildId.current) {
          setUpdateAvailable(true);
        }
      } catch {
        // Network error — skip
      }
    }

    checkVersion();
    const interval = setInterval(checkVersion, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] animate-slide-down">
      <div className="bg-blue-600 text-white px-4 py-2.5 shadow-lg shadow-blue-600/25">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <RefreshCw className="h-4 w-4 shrink-0 animate-spin-slow" />
            <p className="text-sm font-medium truncate">
              A new version of JobPilot is available!
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-white text-blue-700 px-3 py-1 text-xs font-bold hover:bg-blue-50 transition-colors"
            >
              Refresh Now
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="rounded-md p-1 hover:bg-blue-500 transition-colors"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
