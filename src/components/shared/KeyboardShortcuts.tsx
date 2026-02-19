"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "k") {
        e.preventDefault();
        const searchInput =
          document.querySelector<HTMLInputElement>(
            "[data-search-input]"
          ) || document.querySelector<HTMLInputElement>("#search-jobs");
        searchInput?.focus();
      }

      if (isMod && e.key === "Enter") {
        const sendBtn =
          document.querySelector<HTMLButtonElement>(
            "[data-send-button]"
          );
        if (sendBtn && !sendBtn.disabled) {
          e.preventDefault();
          sendBtn.click();
        }
      }

      if (isTyping) return;

      if (e.key === "Escape") {
        const closeBtn =
          document.querySelector<HTMLButtonElement>(
            "[data-close-modal]"
          );
        closeBtn?.click();
      }

      if (isMod && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        router.push("/jobs/new");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
