"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MessageSquarePlus, Bug, Lightbulb, Heart, HelpCircle, Send, X, Check } from "lucide-react";
import { submitFeedback } from "@/app/actions/feedback";
import { toast } from "sonner";

const FEEDBACK_TYPES = [
  { value: "bug" as const, label: "Bug Report", icon: Bug, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", activeBg: "bg-red-100 dark:bg-red-900/50" },
  { value: "suggestion" as const, label: "Suggestion", icon: Lightbulb, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", activeBg: "bg-amber-100 dark:bg-amber-900/50" },
  { value: "compliment" as const, label: "Compliment", icon: Heart, color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-200 dark:border-pink-800", activeBg: "bg-pink-100 dark:bg-pink-900/50" },
  { value: "other" as const, label: "Other", icon: HelpCircle, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", activeBg: "bg-blue-100 dark:bg-blue-900/50" },
] as const;

type FeedbackType = (typeof FEEDBACK_TYPES)[number]["value"];

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("suggestion");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    if (!message.trim() || message.trim().length < 5) {
      toast.error("Please write at least 5 characters");
      return;
    }
    setSending(true);
    try {
      const page = typeof window !== "undefined" ? window.location.pathname : undefined;
      const result = await submitFeedback({ type, message: message.trim(), page });
      if (result.success) {
        setSent(true);
        setTimeout(() => {
          setIsOpen(false);
          setMessage("");
          setType("suggestion");
          setSent(false);
        }, 2000);
      } else {
        toast.error(result.error || "Failed to submit");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSending(false);
    }
  }, [type, message]);

  const activeType = FEEDBACK_TYPES.find((t) => t.value === type)!;

  if (sent) {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-green-200 dark:border-green-800 p-6 sm:p-8 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
            <Check className="w-6 h-6 sm:w-7 sm:h-7 text-green-600" />
          </div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">Thank you!</p>
          <p className="text-sm text-zinc-500">Your feedback helps us improve.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      {isOpen && (
        <div
          ref={panelRef}
          className="mb-3 w-[calc(100vw-2rem)] max-w-[360px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Send Feedback</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Help us make JobPilot better</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          <div className="px-5 pb-2">
            <div className="grid grid-cols-4 gap-2">
              {FEEDBACK_TYPES.map((ft) => {
                const Icon = ft.icon;
                const isActive = type === ft.value;
                return (
                  <button
                    key={ft.value}
                    onClick={() => setType(ft.value)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all text-xs font-medium ${
                      isActive
                        ? `${ft.activeBg} ${ft.border} ${ft.color} ring-1 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900 ${ft.border.replace("border-", "ring-")}`
                        : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-700/50 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? ft.color : ""}`} />
                    <span className="leading-none">{ft.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-5 pb-4 pt-2">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === "bug"
                  ? "What went wrong? Steps to reproduce..."
                  : type === "suggestion"
                    ? "What would make this better?"
                    : type === "compliment"
                      ? "What do you love about JobPilot?"
                      : "Tell us anything..."
              }
              rows={4}
              maxLength={2000}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none transition-colors"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-zinc-400">
                {message.length}/2000
              </span>
              <button
                onClick={handleSubmit}
                disabled={sending || message.trim().length < 5}
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  sending
                    ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                    : `bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5`
                }`}
              >
                {sending ? (
                  <span className="inline-block w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center gap-2 rounded-full shadow-lg transition-all duration-200 ${
          isOpen
            ? "p-3 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900"
            : "p-3 sm:px-4 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-xl hover:shadow-blue-500/25 hover:-translate-y-0.5"
        }`}
        aria-label="Send feedback"
      >
        <MessageSquarePlus className="w-5 h-5" />
        {!isOpen && <span className="hidden sm:inline text-sm font-medium pr-0.5">Feedback</span>}
      </button>
    </div>
  );
}
