"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Plus,
  BarChart3,
  FileText,
  Settings,
  Zap,
  Menu,
  X,
  Radio,
  LogOut,
  Mail,
  Inbox,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ASMark } from "@/components/ui/as-mark";
import { useSidebarStore } from "@/store/useSidebarStore";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Kanban board" },
  { href: "/recommended", label: "Recommended", icon: Sparkles, desc: "Browse all matches" },
  { href: "/applications", label: "Application Queue", icon: Inbox, desc: "Manage applications" },
  { href: "/jobs/new", label: "Add Job", icon: Plus, desc: "Track manually" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, desc: "Performance" },
  { href: "/resumes", label: "Resumes", icon: FileText, desc: "CV variants" },
  { href: "/templates", label: "Templates", icon: Mail, desc: "Email templates" },
  { href: "/system-health", label: "System Health", icon: Radio, desc: "Monitor crons" },
  { href: "/settings", label: "Settings", icon: Settings, desc: "Preferences" },
];

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

  const navItems = adminUser
    ? [...NAV_ITEMS, { href: "/admin", label: "Admin Panel", icon: ShieldCheck, desc: "System admin" }]
    : NAV_ITEMS;

  const isVisible = mobileOpen || !collapsed;

  return (
    <>
      {/* Mobile hamburger — only shows on small screens when sidebar is hidden */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        className="fixed top-3 left-3 z-50 md:hidden bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm touch-manipulation focus-visible:ring-2 focus-visible:ring-blue-500"
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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-blue-600/20">
            <Zap className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">JobPilot</span>
            <span className="ml-1.5 inline-flex items-center rounded-md bg-gradient-to-r from-blue-500/10 to-violet-500/10 dark:from-blue-500/20 dark:to-violet-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20">
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
        <div className="mx-3 mt-4 mb-2 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 p-3 ring-1 ring-emerald-200/50 dark:ring-emerald-800/40">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Automation Active</span>
          </div>
          <p className="mt-1 text-[10px] text-emerald-600/80 dark:text-emerald-500/70 leading-relaxed">
            Daily scan from 8 sources. Emails sent per match.
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-3 py-3 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
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
          })}
        </nav>

        {/* Sources */}
        <div className="border-t border-slate-100 dark:border-zinc-800 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-zinc-500">
            <Radio className="h-3 w-3" />
            <span>8 job sources connected</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            {["JSearch", "Indeed", "Remotive", "Arbeitnow", "Adzuna", "LinkedIn", "Rozee.pk", "Google"].map((s) => (
              <span
                key={s}
                className="inline-block rounded bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 dark:text-zinc-400"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

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
