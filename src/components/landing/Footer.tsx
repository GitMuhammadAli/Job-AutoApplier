import Link from "next/link";
import { Send } from "lucide-react";
import { ASMark } from "@/components/ui/as-mark";

const CREATOR = {
  name: "Ali Shahid",
  github: "https://github.com/GitMuhammadAli",
  linkedin: "https://linkedin.com/in/alishahid-fswebdev",
  portfolio: "https://alishahid-dev.vercel.app",
};

const FOOTER_LINKS = {
  Product: [
    { label: "Features", href: "/features" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "Modes", href: "/modes" },
    { label: "FAQ", href: "/faq" },
  ],
  Resources: [
    { label: "GitHub", href: CREATOR.github },
    { label: "Portfolio", href: CREATOR.portfolio },
    { label: "Changelog", href: "https://github.com/GitMuhammadAli/JobApplier/releases" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Subprocessors", href: "/subprocessors" },
    { label: "Contact", href: "/contact" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-stone-50 dark:bg-stone-950 border-t border-stone-200/70 dark:border-stone-800/60">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          <div>
            <Link href="/" className="flex items-center gap-2.5 group focus-soft">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 shadow-soft-sm transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105">
                <Send size={16} className="text-white" />
              </div>
              <span className="text-lg font-semibold text-stone-900 dark:text-stone-100 tracking-tight">
                JobPilot
              </span>
            </Link>
            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
              Scrape. Score. Draft. Send. Track. One tab.
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500 mb-4">
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors duration-300 focus-soft"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-stone-200/60 dark:border-stone-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <a
              href={CREATOR.portfolio}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 active:scale-95 focus-soft"
            >
              <ASMark size={28} />
            </a>
            <span className="text-sm text-stone-400 dark:text-stone-500">
              Crafted by{" "}
              <a
                href={CREATOR.portfolio}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-stone-600 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors duration-300"
              >
                {CREATOR.name}
              </a>
            </span>
            <div className="flex items-center gap-1.5 ml-1">
              <a
                href={CREATOR.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="text-stone-400 dark:text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors duration-300"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
              <a
                href={CREATOR.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="text-stone-400 dark:text-stone-500 hover:text-[#0A66C2] transition-colors duration-300"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
          <p className="text-sm text-stone-400 dark:text-stone-500">
            © {new Date().getFullYear()} JobPilot. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
