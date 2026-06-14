import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/Navbar";

const Footer = dynamic(() =>
  import("@/components/landing/Footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: "Subprocessors — JobPilot",
  description:
    "The third-party services JobPilot uses, what data each one receives, and where they are located. Last updated June 14, 2026.",
};

const LAST_UPDATED = "June 14, 2026";

type Subprocessor = {
  name: string;
  purpose: string;
  data_received: string;
  location: string;
  url: string;
  dpa_url?: string;
};

const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Vercel",
    purpose: "Application hosting, edge compute, serverless functions, blob storage for resume PDFs",
    data_received: "All HTTP requests, session cookies, uploaded resume PDF files",
    location: "United States · EU (West)",
    url: "https://vercel.com",
    dpa_url: "https://vercel.com/legal/dpa",
  },
  {
    name: "Neon",
    purpose: "Managed PostgreSQL database — primary data store",
    data_received: "Profile data, applications, encrypted SMTP credentials, AI usage logs",
    location: "AWS us-east-1 (United States)",
    url: "https://neon.tech",
    dpa_url: "https://neon.tech/dpa",
  },
  {
    name: "Groq",
    purpose: "Primary AI provider — resume tailoring, email drafting, PDF parsing",
    data_received: "Your CV content + JD text at generation time. Not retained for training per their ToS.",
    location: "United States",
    url: "https://groq.com",
    dpa_url: "https://wow.groq.com/data-processing-addendum/",
  },
  {
    name: "Google (Gemini API)",
    purpose: "Fallback AI provider when Groq is unavailable",
    data_received: "Same as Groq — CV + JD content at generation time",
    location: "United States · Multi-region",
    url: "https://ai.google.dev",
    dpa_url: "https://cloud.google.com/terms/data-processing-addendum",
  },
  {
    name: "Sentry",
    purpose: "Error monitoring and performance tracing",
    data_received: "Stack traces, user ID, route path, request metadata. Message bodies are stripped before transmission.",
    location: "United States · EU available",
    url: "https://sentry.io",
    dpa_url: "https://sentry.io/legal/dpa/",
  },
  {
    name: "Brevo (formerly Sendinblue)",
    purpose: "Transactional email from JobPilot itself (notifications, password reset). Not used for your application emails.",
    data_received: "Your email address and notification content",
    location: "France · European Union",
    url: "https://brevo.com",
    dpa_url: "https://www.brevo.com/legal/termsofuse/#dpa",
  },
  {
    name: "Google (OAuth)",
    purpose: "Authentication via Sign in with Google",
    data_received: "Your name, email address, profile photo (only what OAuth scope grants)",
    location: "United States · Multi-region",
    url: "https://developers.google.com/identity",
    dpa_url: "https://cloud.google.com/terms/data-processing-addendum",
  },
  {
    name: "Upstash (planned)",
    purpose: "Redis-backed rate limiting and quota state (planned, not yet live)",
    data_received: "User ID + timestamp counters for rate-limit windows",
    location: "Multi-region (configurable)",
    url: "https://upstash.com",
    dpa_url: "https://upstash.com/trust/dpa",
  },
];

export default function SubprocessorsPage() {
  return (
    <div className="bg-stone-50 text-stone-700">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        <header className="mb-12">
          <p className="font-mono text-xs uppercase tracking-wide text-stone-500">
            Legal
          </p>
          <h1 className="mt-2 font-display text-4xl leading-tight text-stone-900">
            Subprocessors
          </h1>
          <p className="mt-3 text-sm text-stone-500">
            Last updated {LAST_UPDATED}
          </p>
          <p className="mt-4 max-w-prose text-base leading-relaxed">
            JobPilot uses the following third-party services to operate. Each one
            sees a subset of your data, listed below. By using JobPilot you
            consent to this processing. Material additions are announced at least
            14 days in advance.
          </p>
        </header>

        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft-sm">
          {SUBPROCESSORS.map((sp, idx) => (
            <div
              key={sp.name}
              className={`grid gap-4 p-6 md:grid-cols-[200px_1fr] ${
                idx > 0 ? "border-t border-stone-200" : ""
              }`}
            >
              <div>
                <h2 className="font-display text-lg text-stone-900">
                  {sp.name}
                </h2>
                <p className="mt-1 text-xs text-stone-500">{sp.location}</p>
                <p className="mt-3 flex flex-col gap-1 font-mono text-xs">
                  <a
                    href={sp.url}
                    className="text-emerald-600 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Website ↗
                  </a>
                  {sp.dpa_url && (
                    <a
                      href={sp.dpa_url}
                      className="text-emerald-600 underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      DPA ↗
                    </a>
                  )}
                </p>
              </div>

              <div>
                <p className="text-sm">
                  <span className="font-medium text-stone-900">
                    Purpose:&nbsp;
                  </span>
                  <span className="text-stone-700">{sp.purpose}</span>
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-medium text-stone-900">
                    Data received:&nbsp;
                  </span>
                  <span className="text-stone-700">{sp.data_received}</span>
                </p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-2xl border border-stone-200 bg-white p-8">
          <h2 className="font-display text-xl text-stone-900">
            Notification of changes
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            We&rsquo;ll post additions or replacements on this page and, if you
            have an account, notify you by email at least 14 days before the
            change takes effect. Existing accounts may object to a new
            subprocessor by deleting their account before the effective date.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-stone-200 bg-stone-100 p-8">
          <h2 className="font-display text-xl text-stone-900">
            Not subprocessors
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            For clarity, the following are <em>not</em> subprocessors:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-sm leading-relaxed text-stone-700">
            <li>
              Your own SMTP provider (Gmail, Outlook, etc.) — your application
              emails leave JobPilot directly via the credentials you provide,
              with no JobPilot-controlled relay in between.
            </li>
            <li>
              Job boards we scrape (LinkedIn, Indeed, Rozee.pk, etc.) — we read
              from their public job listings but do not share your data with
              them.
            </li>
            <li>
              Employers — JobPilot has no relationship with any employer. Your
              application emails reach them under your name, not ours.
            </li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  );
}
