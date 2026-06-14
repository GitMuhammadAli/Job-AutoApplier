"use client";

/**
 * ⌘K Command Palette.
 *
 * Quick navigation + actions, cmd+k / ctrl+k to open. Filter-as-you-type.
 *
 * Routes are statically declared here — keeps the bundle tiny and gives us
 * a single audit point if a route is renamed / removed. We also expose a few
 * actions (Generate resume, New job) that fire navigation with a `?action=`
 * query the destination handles.
 *
 * Aesthetic: warm stone, soft shadow, longer ease — matches tokens.css.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Sparkles,
  Settings,
  BarChart3,
  Heart,
  ScrollText,
  Wand2,
  Plus,
  Activity,
  HelpCircle,
  LogOut,
  ShieldCheck,
  Download,
} from "lucide-react";

interface CommandItem {
  group: "Navigate" | "Resumes" | "Actions" | "Account";
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  /** When set, fires this side-effect instead of navigating. */
  action?: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const items: CommandItem[] = React.useMemo(
    () => [
      // ── Navigate ─────────────────────────────────────────────────
      { group: "Navigate", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { group: "Navigate", label: "Jobs", icon: Briefcase, href: "/jobs", keywords: ["postings", "applications"] },
      { group: "Navigate", label: "Recommended", icon: Heart, href: "/recommended", keywords: ["matches", "fit"] },
      { group: "Navigate", label: "Applications", icon: ScrollText, href: "/applications", keywords: ["tracker", "kanban"] },
      { group: "Navigate", label: "Analytics", icon: BarChart3, href: "/analytics" },
      { group: "Navigate", label: "System health", icon: Activity, href: "/system-health", keywords: ["scrapers", "status"] },

      // ── Resumes ──────────────────────────────────────────────────
      { group: "Resumes", label: "My resumes", icon: FileText, href: "/resumes" },
      { group: "Resumes", label: "Tailor resume", icon: Wand2, href: "/resumes/tailor", keywords: ["jd", "generate", "ai"] },
      { group: "Resumes", label: "Skill gaps", icon: Sparkles, href: "/resumes/gaps" },
      { group: "Resumes", label: "Profile setup", icon: FileText, href: "/resumes/setup", keywords: ["edit", "fill"] },
      { group: "Resumes", label: "Outcomes", icon: BarChart3, href: "/resumes/outcomes", keywords: ["reply rate"] },

      // ── Actions ──────────────────────────────────────────────────
      {
        group: "Actions",
        label: "Generate a tailored resume",
        hint: "G then T",
        icon: Wand2,
        href: "/resumes/tailor?focus=jd",
        keywords: ["new resume", "create"],
      },
      {
        group: "Actions",
        label: "Add a job manually",
        hint: "G then J",
        icon: Plus,
        href: "/jobs/new",
        keywords: ["track", "log"],
      },

      // ── Account ──────────────────────────────────────────────────
      { group: "Account", label: "Settings", icon: Settings, href: "/settings" },
      {
        group: "Account",
        label: "Export my data",
        icon: Download,
        href: "/api/account/export",
        keywords: ["gdpr", "download", "backup"],
      },
      { group: "Account", label: "Privacy", icon: ShieldCheck, href: "/privacy" },
      { group: "Account", label: "Help & FAQ", icon: HelpCircle, href: "/faq" },
      {
        group: "Account",
        label: "Sign out",
        icon: LogOut,
        action: () => {
          // Defer to NextAuth's signout endpoint — works without importing
          // the client SDK so the palette stays light.
          window.location.href = "/api/auth/signout";
        },
      },
    ],
    [],
  );

  const grouped = React.useMemo(() => {
    const g = new Map<string, CommandItem[]>();
    for (const item of items) {
      if (!g.has(item.group)) g.set(item.group, []);
      g.get(item.group)!.push(item);
    }
    return Array.from(g.entries());
  }, [items]);

  const runItem = (item: CommandItem) => {
    setOpen(false);
    if (item.action) {
      item.action();
      return;
    }
    if (item.href) {
      if (item.href.startsWith("/api/")) {
        window.location.href = item.href;
      } else {
        router.push(item.href);
      }
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm animate-in fade-in duration-200"
        aria-hidden
      />
      <Command
        label="Search commands"
        shouldFilter
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200/80 bg-stone-50 shadow-soft-xl ring-1 ring-stone-900/5 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center gap-3 border-b border-stone-200/80 px-4 py-3">
          <Sparkles className="size-4 text-stone-500" aria-hidden />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Search pages, actions, settings…"
            className="flex-1 bg-transparent text-[15px] text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center rounded-md border border-stone-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-stone-500">
            esc
          </kbd>
        </div>
        <Command.List className="max-h-[60vh] overflow-y-auto px-2 py-2">
          <Command.Empty className="px-4 py-10 text-center text-sm text-stone-500">
            No results. Try a different search.
          </Command.Empty>
          {grouped.map(([group, groupItems]) => (
            <Command.Group
              key={group}
              heading={group}
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-stone-400"
            >
              {groupItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={`${group}:${item.label}`}
                    value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                    onSelect={() => runItem(item)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-stone-700 transition-colors duration-200 data-[selected=true]:bg-stone-100 data-[selected=true]:text-stone-900"
                  >
                    <Icon className="size-4 text-stone-400 group-data-[selected=true]:text-stone-600" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {item.hint ? (
                      <span className="text-[11px] text-stone-400">{item.hint}</span>
                    ) : null}
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
        <div className="flex items-center justify-between border-t border-stone-200/80 bg-stone-100/60 px-3 py-2 text-[11px] text-stone-500">
          <span className="flex items-center gap-1.5">
            <kbd className="inline-flex h-4 items-center rounded border border-stone-200 bg-white px-1 font-medium">↑</kbd>
            <kbd className="inline-flex h-4 items-center rounded border border-stone-200 bg-white px-1 font-medium">↓</kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="inline-flex h-4 items-center rounded border border-stone-200 bg-white px-1 font-medium">↵</kbd>
            to select
          </span>
        </div>
      </Command>
    </div>
  );
}
