"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  BarChart3,
  FileText,
  Settings,
  Send,
  Menu,
  X,
  LogOut,
  Mail,
  Inbox,
  ShieldCheck,
  PanelLeftClose,
  Sparkles,
  Activity,
  Pause,
  Radar,
  TrendingUp,
  FileSearch,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ASMark } from "@/components/ui/as-mark";
import { useSidebarStore } from "@/store/useSidebarStore";

const MAIN_NAV = [
  { href: "/dashboard", label: "My Jobs", icon: LayoutDashboard, desc: "Your job board" },
  { href: "/recommended", label: "Find Jobs", icon: Sparkles, desc: "New matches for you" },
  { href: "/applications", label: "Applications", icon: Inbox, desc: "Emails & apply status" },
];

const TOOLS_NAV = [
  { href: "/resumes", label: "Resumes", icon: FileText, desc: "Your uploaded CVs" },
  { href: "/templates", label: "Templates", icon: Mail, desc: "Email templates" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, desc: "Your progress" },
  { href: "/system-health", label: "System Status", icon: Activity, desc: "Background services" },
];

const BOTTOM_NAV = [
  { href: "/settings", label: "Settings", icon: Settings, desc: "Preferences" },
];

const DEVRADAR_URL = process.env.NEXT_PUBLIC_DEVRADAR_URL;

const DEVRADAR_NAV = DEVRADAR_URL
  ? [
      { href: `${DEVRADAR_URL}/skills`, label: "Skill Trends", icon: TrendingUp, desc: "What's in demand" },
      { href: `${DEVRADAR_URL}/resume`, label: "Resume Gaps", icon: FileSearch, desc: "Analyze your fit" },
      { href: `${DEVRADAR_URL}/interview`, label: "Interview Prep", icon: MessageSquare, desc: "AI mock interviews" },
      { href: `${DEVRADAR_URL}/salaries`, label: "Salaries", icon: BarChart3, desc: "Market pay data" },
    ]
  : [];

interface SidebarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  isAdmin?: boolean;
}

export function Sidebar({ user, isAdmin: adminUser }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, mobileOpen, toggle, setMobileOpen } = useSidebarStore();
  const [accountStatus, setAccountStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/mode")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.status) setAccountStatus(data.status);
      })
      .catch(() => {});
  }, []);

  const adminNav = adminUser
    ? [{ href: "/admin", label: "Admin Panel", icon: ShieldCheck, desc: "System admin" }]
    : [];

  const isVisible = mobileOpen || !collapsed;

  return (
    <>
      {/* Mobile hamburger — only shows on small screens when sidebar is hidden */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        className="fixed top-3 left-3 z-[60] md:hidden bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm shadow-md border border-slate-200/60 dark:border-zinc-700/60 touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-500"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white dark:bg-zinc-900 border-r border-slate-200/80 dark:border-zinc-700/80 transition-transform duration-300 ease-out",
          mobileOpen
            ? "translate-x-0"
            : collapsed
              ? "-translate-x-full"
              : "max-md:-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo area */}
        <div className="flex h-16 items-center gap-3 px-5 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 shadow-lg shadow-emerald-600/25">
            <Send className="h-4 w-4 text-white -translate-x-[1px]" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">JobPilot</span>
            <span className="ml-1.5 inline-flex items-center rounded-md bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
              PRO
            </span>
          </div>
          {/* Desktop collapse button */}
          <button
            onClick={() => {
              if (mobileOpen) setMobileOpen(false);
              else toggle();
            }}
            aria-label="Collapse sidebar"
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
            className="md:hidden flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Automation status */}
        {accountStatus === "paused" ? (
          <div className="mx-3 mt-4 mb-2 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 p-3 ring-1 ring-amber-200/50 dark:ring-amber-800/40">
            <div className="flex items-center gap-2">
              <Pause className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Auto-Apply Paused</span>
            </div>
            <p className="mt-1 text-[10px] text-amber-600/80 dark:text-amber-500/70 leading-relaxed">
              Jobs are still being found. Auto-sending is paused.
            </p>
          </div>
        ) : (
          <div className="mx-3 mt-4 mb-2 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 p-3 ring-1 ring-emerald-200/50 dark:ring-emerald-800/40">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Auto-Search Active</span>
            </div>
            <p className="mt-1 text-[10px] text-emerald-600/80 dark:text-emerald-500/70 leading-relaxed">
              Finding jobs from 8 sites for you automatically.
            </p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto scrollbar-thin flex flex-col">
          {/* Main */}
          <div className="space-y-0.5">
            {MAIN_NAV.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            ))}
          </div>

          {/* Tools */}
          <div className="mt-5">
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Tools</p>
            <div className="space-y-0.5">
              {TOOLS_NAV.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              ))}
            </div>
          </div>

          {/* DevRadar — only shows when NEXT_PUBLIC_DEVRADAR_URL is configured */}
          {DEVRADAR_NAV.length > 0 && (
            <div className="mt-5">
              <div className="mx-0 mb-2 rounded-xl bg-gradient-to-r from-rose-500/8 to-purple-500/8 dark:from-rose-500/10 dark:to-purple-500/10 p-2.5 ring-1 ring-rose-200/30 dark:ring-rose-800/20">
                <div className="flex items-center gap-2 px-1">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-rose-500/20 to-purple-500/20">
                    <Radar className="h-3 w-3 text-rose-500 dark:text-rose-400" />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider bg-gradient-to-r from-rose-500 to-purple-500 bg-clip-text text-transparent">DevRadar</p>
                </div>
              </div>
              <div className="space-y-0.5">
                {DEVRADAR_NAV.map((item) => (
                  <ExternalNavLink key={item.href} item={item} onNavigate={() => setMobileOpen(false)} />
                ))}
              </div>
              <a
                href={DEVRADAR_URL!}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-center gap-2 mx-1 mt-2 rounded-lg bg-gradient-to-r from-rose-500 to-purple-500 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm shadow-rose-500/20 hover:shadow-md hover:shadow-rose-500/30 transition-all hover:brightness-110"
              >
                <Radar className="h-3 w-3" />
                Open DevRadar
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            </div>
          )}

          <div className="flex-1" />

          {/* Bottom — Settings + Admin */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-0.5">
            {BOTTOM_NAV.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            ))}
            {adminNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            ))}
          </div>
        </nav>

        {/* User info + sign out */}
        {user && (
          <div className="border-t border-slate-100 dark:border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2.5">
              {user.image ? (
                <img src={user.image} alt={user.name || "User avatar"} className="h-8 w-8 rounded-full ring-1 ring-slate-200 dark:ring-zinc-700" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-xs font-bold">
                  {(user.name || user.email || "?")[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{user.name || "User"}</p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{user.email || ""}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                aria-label="Sign out"
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none touch-manipulation"
              >
                <LogOut className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
              </button>
            </div>
          </div>
        )}

        <a
          href="https://alishahid-dev.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 px-4 py-2 opacity-40 hover:opacity-100 transition-all group hover:scale-105 active:scale-95"
        >
          <ASMark size={16} />
          <span className="text-[9px] text-zinc-400 dark:text-zinc-600 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            by Ali Shahid
          </span>
        </a>
      </aside>
    </>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; desc: string };
  pathname: string;
  onNavigate: () => void;
}) {
  const isActive =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
        isActive
          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/25"
          : "text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
          isActive
            ? "bg-white/20"
            : "bg-slate-100 dark:bg-zinc-800 group-hover:bg-slate-200/70 dark:group-hover:bg-zinc-700"
        )}
      >
        <item.icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-500 dark:text-zinc-400 group-hover:text-slate-700 dark:group-hover:text-zinc-200")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-semibold", isActive ? "text-white" : "text-slate-700 dark:text-zinc-200")}>{item.label}</div>
        <div className={cn("text-[10px] leading-tight", isActive ? "text-blue-100" : "text-slate-400 dark:text-zinc-500")}>{item.desc}</div>
      </div>
    </Link>
  );
}

function ExternalNavLink({
  item,
  onNavigate,
}: {
  item: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; desc: string };
  onNavigate: () => void;
}) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onNavigate}
      className="group flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200 text-slate-500 dark:text-zinc-400 hover:bg-gradient-to-r hover:from-rose-50/50 hover:to-purple-50/50 dark:hover:from-rose-950/15 dark:hover:to-purple-950/15"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500/10 to-purple-500/10 dark:from-rose-500/15 dark:to-purple-500/15 ring-1 ring-rose-200/20 dark:ring-rose-800/15 group-hover:from-rose-500/20 group-hover:to-purple-500/20 transition-all">
        <item.icon className="h-3.5 w-3.5 text-rose-500/70 dark:text-rose-400/70 group-hover:text-rose-500 dark:group-hover:text-rose-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-slate-600 dark:text-zinc-300 group-hover:bg-gradient-to-r group-hover:from-rose-600 group-hover:to-purple-600 dark:group-hover:from-rose-400 dark:group-hover:to-purple-400 group-hover:bg-clip-text group-hover:text-transparent">{item.label}</div>
        <div className="text-[10px] leading-tight text-slate-400 dark:text-zinc-500">{item.desc}</div>
      </div>
      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity text-purple-400" />
    </a>
  );
}
