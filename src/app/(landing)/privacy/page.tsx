import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/Navbar";

const Footer = dynamic(() =>
  import("@/components/landing/Footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: "Privacy Policy — JobPilot",
  description:
    "What data JobPilot collects, why, who we share it with, and how to delete it. Last updated June 14, 2026.",
};

const LAST_UPDATED = "June 14, 2026";

export default function PrivacyPage() {
  return (
    <div className="bg-stone-50 text-stone-700">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <header className="mb-12">
          <p className="font-mono text-xs uppercase tracking-wide text-stone-500">
            Legal
          </p>
          <h1 className="mt-2 font-display text-4xl leading-tight text-stone-900">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-stone-500">
            Last updated {LAST_UPDATED}
          </p>
        </header>

        <Section title="The short version">
          <p>
            JobPilot stores the personal data you upload (your CV, contact info,
            preferred job keywords) so that the product can match you to jobs and
            draft application emails. The product sends those emails from{" "}
            <em>your</em> Gmail (or other SMTP account) using credentials you
            provide and that we encrypt at rest. We do not sell your data. We do
            not share it with employers — we only send the emails you authorize.
          </p>
          <p className="mt-3">
            You can export everything or delete your account at any time from{" "}
            <a href="/settings" className="text-emerald-600 underline">
              Settings
            </a>
            .
          </p>
        </Section>

        <Section title="Data we collect">
          <h3 className="font-display text-base text-stone-900">
            You give us
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Name, email address, phone number, location, links (LinkedIn / GitHub / portfolio)</li>
            <li>Resume content — uploaded PDFs and the structured profile you build manually</li>
            <li>Job preferences — keywords, salary range, work types, target roles</li>
            <li>Email-sending credentials (Gmail App Password or other SMTP user/password), encrypted at rest with AES-256 before storage</li>
            <li>Optional: a custom system prompt, signature, preferred tone</li>
          </ul>

          <h3 className="mt-6 font-display text-base text-stone-900">
            We collect automatically
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Authentication metadata (session ID, login timestamps) via NextAuth</li>
            <li>Error reports via Sentry (route, user ID, stack trace — no message body content)</li>
            <li>Aggregate usage metrics (counts of applications sent, AI tokens consumed) for quota enforcement and capacity planning</li>
          </ul>

          <h3 className="mt-6 font-display text-base text-stone-900">
            We do <em>not</em> collect
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Browsing history outside of JobPilot</li>
            <li>Contents of your email inbox (we only see drafts you generate and emails you send)</li>
            <li>Bank or payment information (no billing)</li>
            <li>Biometric data, precise geolocation, or device identifiers</li>
          </ul>
        </Section>

        <Section title="How we use your data">
          <ul className="list-disc space-y-1 pl-6">
            <li>Match your profile against scraped job listings from third-party job boards</li>
            <li>Generate tailored resume PDFs and email drafts via Groq and Google Gemini APIs</li>
            <li>Send emails to recipients <em>you</em> approve, from <em>your</em> email account</li>
            <li>Monitor errors and AI cost via Sentry and our own logs</li>
            <li>Notify you about your application status, follow-up drafts, and AI quota</li>
          </ul>
          <p className="mt-3">
            We do not train AI models on your data. We do not use your CV to
            target advertising. We do not sell your information.
          </p>
        </Section>

        <Section title="Who we share data with">
          <p>
            JobPilot uses third-party subprocessors to operate. Each is listed
            with the data it sees on the{" "}
            <a href="/subprocessors" className="text-emerald-600 underline">
              Subprocessors page
            </a>
            . The current list:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Vercel</strong> — hosting and serverless compute (US/EU);
              processes every request and stores uploaded resume PDFs in Vercel
              Blob
            </li>
            <li>
              <strong>Neon</strong> — managed Postgres database (US East); stores
              your profile and application records
            </li>
            <li>
              <strong>Groq</strong> — primary AI provider; receives your CV text
              and JD when generating tailored resumes / emails
            </li>
            <li>
              <strong>Google (Gemini)</strong> — fallback AI provider when Groq
              is rate-limited or unavailable; sees the same data
            </li>
            <li>
              <strong>Sentry</strong> — error monitoring; receives stack traces
              and your user ID (no email body content)
            </li>
            <li>
              <strong>Brevo</strong> — used for some transactional notifications
              from JobPilot itself (not your application emails)
            </li>
            <li>
              <strong>NextAuth providers</strong> — Google OAuth for sign-in
            </li>
          </ul>
          <p className="mt-3">
            Application emails you send leave JobPilot via{" "}
            <em>your own SMTP account</em>. JobPilot is not a middleman SMTP — we
            never have a copy of the sent message after the send completes.
          </p>
        </Section>

        <Section title="Your rights">
          <p>Wherever you are, you can:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Access</strong> — see every field we have on you, at{" "}
              <a href="/settings/account/export" className="text-emerald-600 underline">
                Settings → Export
              </a>{" "}
              (full JSON dump)
            </li>
            <li>
              <strong>Rectify</strong> — edit any profile field directly in{" "}
              <a href="/resumes" className="text-emerald-600 underline">
                /resumes
              </a>{" "}
              and{" "}
              <a href="/settings" className="text-emerald-600 underline">
                /settings
              </a>
            </li>
            <li>
              <strong>Delete</strong> — purge your account and all associated
              data (DB rows + uploaded blob files + Sentry user record) within 30
              days. Action at{" "}
              <a href="/settings#delete" className="text-emerald-600 underline">
                Settings → Delete account
              </a>
            </li>
            <li>
              <strong>Restrict / object</strong> — pause processing (disable
              auto-apply, cron jobs) without deleting via Settings → Automation
            </li>
            <li>
              <strong>Portability</strong> — the JSON dump above is your data,
              importable elsewhere
            </li>
          </ul>
          <p className="mt-3">
            EU/UK users: these rights map to GDPR Articles 15–22 and UK DPA
            equivalents. Contact{" "}
            <a href="/contact" className="text-emerald-600 underline">
              support
            </a>{" "}
            for DSAR requests.
          </p>
        </Section>

        <Section title="Retention">
          <ul className="list-disc space-y-1 pl-6">
            <li>Profile + applications: kept while your account is active</li>
            <li>
              Resume PDF blobs: deleted on account deletion or when you explicitly
              remove the upload
            </li>
            <li>
              Sentry error reports: 30 days, then auto-purged by Sentry default
              retention
            </li>
            <li>
              Aggregate AI usage logs: 90 days (for capacity planning and abuse
              detection)
            </li>
            <li>
              After account deletion: 30-day soft-delete grace, then hard purge
              from DB and Blob storage. Backup snapshots cycle out within 90 days.
            </li>
          </ul>
        </Section>

        <Section title="Security">
          <ul className="list-disc space-y-1 pl-6">
            <li>SMTP credentials: AES-256-GCM encrypted at rest with versioned keys</li>
            <li>Database connections: TLS-only</li>
            <li>Resume PDFs: stored in private Vercel Blob with signed short-lived URLs</li>
            <li>Sessions: HttpOnly, Secure, SameSite=Lax cookies</li>
            <li>Rate limits + abuse detection on all auth and AI surfaces</li>
          </ul>
          <p className="mt-3 text-sm text-stone-500">
            If you discover a security issue, please email{" "}
            <a href="mailto:security@jobapplier.app" className="text-emerald-600 underline">
              security@jobapplier.app
            </a>{" "}
            rather than opening a public issue.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use functional cookies only — authentication session and theme
            preference. We do <em>not</em> use third-party advertising cookies.
            Sentry telemetry is loaded only after you accept the cookie banner.
          </p>
        </Section>

        <Section title="Children">
          <p>
            JobPilot is not directed at children under 16. If we learn we
            collected data from a child without verifiable parental consent, we
            delete it.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We&rsquo;ll post material changes to this page and, if you have an
            account, notify you by email at least 14 days before they take
            effect.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Data controller: Ali Shahid · JobPilot (sole proprietorship), Lahore,
            Pakistan.
          </p>
          <p className="mt-3">
            Reach us at{" "}
            <a href="/contact" className="text-emerald-600 underline">
              /contact
            </a>{" "}
            or{" "}
            <a
              href="mailto:privacy@jobapplier.app"
              className="text-emerald-600 underline"
            >
              privacy@jobapplier.app
            </a>
            .
          </p>
        </Section>
      </main>
      <Footer />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 font-display text-2xl leading-tight text-stone-900">
        {title}
      </h2>
      <div className="space-y-2 text-base leading-relaxed">{children}</div>
    </section>
  );
}
