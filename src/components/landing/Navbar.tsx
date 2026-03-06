"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Send } from "lucide-react";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#modes", label: "Modes" },
  { href: "#faq", label: "FAQ" },
];

const DEVRADAR_URL = process.env.NEXT_PUBLIC_DEVRADAR_URL;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl shadow-[0_1px_0_0_rgba(0,0,0,0.05)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)]"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-500 shadow-md shadow-emerald-600/20 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-emerald-500/30">
            <Send className="h-3.5 w-3.5 text-white -translate-x-[1px]" />
          </div>
          <span className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
            JobPilot
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
          {DEVRADAR_URL && (
            <div className="relative group/tip">
              <a
                href={DEVRADAR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-1.5 cursor-pointer font-medium text-[13px] px-4 py-2 text-white bg-gradient-to-r from-rose-500 to-purple-500 border-none tracking-wide rounded-full transition-all duration-300 hover:from-rose-600 hover:to-purple-600 hover:shadow-[0_0_30px_rgba(251,113,133,0.3)] active:scale-[0.97]"
              >
                <svg height="16" width="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] rotate-[30deg] group-hover:rotate-90 group-hover:translate-x-0.5">
                  <path d="M0 0h24v24H0z" fill="none" />
                  <path d="M5 13c0-5.088 2.903-9.436 7-11.182C16.097 3.564 19 7.912 19 13c0 .823-.076 1.626-.22 2.403l1.94 1.832a.5.5 0 0 1 .095.603l-2.495 4.575a.5.5 0 0 1-.793.114l-2.234-2.234a1 1 0 0 0-.707-.293H9.414a1 1 0 0 0-.707.293l-2.234 2.234a.5.5 0 0 1-.793-.114l-2.495-4.575a.5.5 0 0 1 .095-.603l1.94-1.832C5.077 14.626 5 13.823 5 13zm1.476 6.696l.817-.817A3 3 0 0 1 9.414 18h5.172a3 3 0 0 1 2.121.879l.817.817.982-1.8-1.1-1.04a2 2 0 0 1-.593-1.82c.124-.664.187-1.345.187-2.036 0-3.87-1.995-7.3-5-8.96C8.995 5.7 7 9.13 7 13c0 .691.063 1.372.187 2.037a2 2 0 0 1-.593 1.82l-1.1 1.039.982 1.8zM12 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="currentColor" />
                </svg>
                <span className="transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:translate-x-1">
                  DevRadar
                </span>
              </a>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 rounded-xl bg-zinc-900 dark:bg-zinc-800 p-3 shadow-xl shadow-black/20 border border-zinc-700/50 opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50">
                <p className="text-[11px] font-semibold text-white mb-1">AI Career Intelligence</p>
                <p className="text-[10px] text-zinc-400 leading-relaxed">Skill trends, salary data, resume gap analysis, and AI interview prep — all powered by real job market data.</p>
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-zinc-900 dark:bg-zinc-800 border-l border-t border-zinc-700/50" />
              </div>
            </div>
          )}
          <Link
            href="/login"
            className="rounded-full bg-zinc-900 dark:bg-white px-5 py-2 text-[13px] font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            Get Started — It&apos;s Free
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 -mr-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
          mobileOpen ? "max-h-72 opacity-100" : "max-h-0 opacity-0"
        } bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-100 dark:border-zinc-800`}
      >
        <div className="px-6 py-4 space-y-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
          {DEVRADAR_URL && (
            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 px-1">Also by us</p>
              <a
                href={DEVRADAR_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                className="group flex items-center gap-3 rounded-xl bg-gradient-to-r from-rose-500/10 to-purple-500/10 dark:from-rose-500/15 dark:to-purple-500/15 px-4 py-3 ring-1 ring-rose-200/30 dark:ring-rose-800/20 transition-all duration-300 hover:from-rose-500/20 hover:to-purple-500/20"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-purple-500 shadow-sm">
                  <svg height="16" width="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-white rotate-[30deg]">
                    <path d="M0 0h24v24H0z" fill="none" />
                    <path d="M5 13c0-5.088 2.903-9.436 7-11.182C16.097 3.564 19 7.912 19 13c0 .823-.076 1.626-.22 2.403l1.94 1.832a.5.5 0 0 1 .095.603l-2.495 4.575a.5.5 0 0 1-.793.114l-2.234-2.234a1 1 0 0 0-.707-.293H9.414a1 1 0 0 0-.707.293l-2.234 2.234a.5.5 0 0 1-.793-.114l-2.495-4.575a.5.5 0 0 1 .095-.603l1.94-1.832C5.077 14.626 5 13.823 5 13zm1.476 6.696l.817-.817A3 3 0 0 1 9.414 18h5.172a3 3 0 0 1 2.121.879l.817.817.982-1.8-1.1-1.04a2 2 0 0 1-.593-1.82c.124-.664.187-1.345.187-2.036 0-3.87-1.995-7.3-5-8.96C8.995 5.7 7 9.13 7 13c0 .691.063 1.372.187 2.037a2 2 0 0 1-.593 1.82l-1.1 1.039.982 1.8zM12 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="currentColor" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold bg-gradient-to-r from-rose-600 to-purple-600 dark:from-rose-400 dark:to-purple-400 bg-clip-text text-transparent">DevRadar</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Skill trends, salaries & interview prep</p>
                </div>
              </a>
            </div>
          )}
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="mt-2 block text-center rounded-full bg-zinc-900 dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
          >
            Get Started — It&apos;s Free
          </Link>
        </div>
      </div>
    </nav>
  );
}
