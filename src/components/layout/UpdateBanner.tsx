"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 60_000;

export function UpdateBanner() {
  const initialBuildId = useRef<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const { buildId } = await res.json();

      if (!initialBuildId.current) {
        initialBuildId.current = buildId;
        return;
      }

      if (buildId !== initialBuildId.current) {
        setUpdateAvailable(true);
      }
    } catch {
      /* network hiccup — ignore */
    }
  }, []);

  useEffect(() => {
    checkVersion();
    const id = setInterval(checkVersion, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkVersion]);

  const handleRefresh = () => {
    setRefreshing(true);
    window.location.reload();
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5",
        "bg-gradient-to-r from-blue-600 via-violet-600 to-blue-600 text-white",
        "shadow-lg shadow-blue-600/20 animate-in slide-in-from-top-2 duration-300",
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 flex-shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            New update available!
          </p>
          <p className="text-[11px] text-blue-100 truncate">
            We&apos;ve shipped improvements. Refresh to get the latest version.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-7 bg-white text-blue-700 hover:bg-blue-50 shadow-sm text-xs font-semibold px-3"
        >
          {refreshing ? (
            <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1.5" />
          )}
          {refreshing ? "Refreshing..." : "Refresh Now"}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update notification"
          className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/20 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
