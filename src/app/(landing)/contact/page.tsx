import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Mail, Github, MessageSquare, ShieldAlert } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";

const Footer = dynamic(() =>
  import("@/components/landing/Footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: "Contact — JobPilot",
  description:
    "Reach JobPilot — for bug reports, feature ideas, privacy requests, security disclosures. We answer within 48 hours.",
};

const CHANNELS = [
  {
    title: "Bug reports & feature ideas",
    detail:
      "Open a GitHub issue. Public, searchable, with the fastest response time.",
    action: "Open an issue",
    href: "https://github.com/GitMuhammadAli/JobApplier/issues/new",
    icon: Github,
  },
  {
    title: "General support",
    detail: "Email us. We answer within 48 hours, usually faster.",
    action: "hello@jobapplier.app",
    href: "mailto:hello@jobapplier.app",
    icon: MessageSquare,
  },
  {
    title: "Privacy & data requests",
    detail:
      "Account export, deletion confirmation, data-subject access requests under GDPR/DPA.",
    action: "privacy@jobapplier.app",
    href: "mailto:privacy@jobapplier.app",
    icon: Mail,
  },
  {
    title: "Security disclosures",
    detail:
      "Vulnerability reports. Please do not open public issues for security findings.",
    action: "security@jobapplier.app",
    href: "mailto:security@jobapplier.app",
    icon: ShieldAlert,
  },
];

export default function ContactPage() {
  return (
    <div className="bg-stone-50 text-stone-700">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <header className="mb-12">
          <p className="font-mono text-xs uppercase tracking-wide text-stone-500">
            Get in touch
          </p>
          <h1 className="mt-2 font-display text-4xl leading-tight text-stone-900">
            Contact
          </h1>
          <p className="mt-3 max-w-prose text-base leading-relaxed">
            JobPilot is built by{" "}
            <a
              href="https://github.com/GitMuhammadAli"
              className="text-emerald-600 underline"
            >
              Ali Shahid
            </a>
            . Pick the right channel below — they all reach a human, but the
            right one routes faster.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {CHANNELS.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.title}
                href={c.href}
                className="group rounded-2xl border border-stone-200 bg-white p-6 shadow-soft-sm transition-all duration-fast ease-soft-out hover:shadow-soft-md hover:-translate-y-px"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-600 transition-colors duration-fast group-hover:bg-emerald-50 group-hover:text-emerald-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg leading-tight text-stone-900">
                  {c.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {c.detail}
                </p>
                <p className="mt-4 font-mono text-xs text-emerald-600">
                  {c.action} →
                </p>
              </a>
            );
          })}
        </div>

        <section className="mt-16 rounded-2xl border border-stone-200 bg-white p-8">
          <h2 className="font-display text-xl text-stone-900">
            Office hours
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Solo founder, primary time zone PKT (UTC+5). Replies usually within
            24 hours, always within 48. Critical security issues take priority
            and are acknowledged within 4 business hours.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-stone-200 bg-stone-100 p-8">
          <h2 className="font-display text-xl text-stone-900">
            Mailing address
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            JobPilot · Ali Shahid (sole proprietor)
            <br />
            Lahore, Punjab, Pakistan
          </p>
          <p className="mt-3 text-xs text-stone-500">
            Need a postal address for a formal data-subject request? Email{" "}
            <a
              href="mailto:legal@jobapplier.app"
              className="text-emerald-600 underline"
            >
              legal@jobapplier.app
            </a>{" "}
            and we&rsquo;ll respond with a registered correspondence address.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
