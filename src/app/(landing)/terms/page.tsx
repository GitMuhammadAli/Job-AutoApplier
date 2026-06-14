import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/Navbar";

const Footer = dynamic(() =>
  import("@/components/landing/Footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: "Terms of Service — JobPilot",
  description:
    "The rules for using JobPilot. Plain-English version up top, full terms below. Last updated June 14, 2026.",
};

const LAST_UPDATED = "June 14, 2026";

export default function TermsPage() {
  return (
    <div className="bg-stone-50 text-stone-700">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <header className="mb-12">
          <p className="font-mono text-xs uppercase tracking-wide text-stone-500">
            Legal
          </p>
          <h1 className="mt-2 font-display text-4xl leading-tight text-stone-900">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-stone-500">
            Last updated {LAST_UPDATED}
          </p>
        </header>

        <Section title="The plain-English version">
          <p>
            By using JobPilot you agree to these terms. The short version:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Don&rsquo;t use JobPilot to send spam, fraud, or harassment.</li>
            <li>Don&rsquo;t fabricate credentials, employers, degrees, or certifications on the resumes you generate. JobPilot has built-in audit checks that block fabrication — don&rsquo;t try to bypass them.</li>
            <li>You&rsquo;re responsible for the emails JobPilot sends from your account. They go out under your name and your SMTP credentials.</li>
            <li>We can suspend accounts that abuse the system, send to suppressed addresses, or break this list.</li>
            <li>JobPilot is provided as-is. It does not guarantee a job, a callback, or that any email will reach an inbox.</li>
            <li>You can leave at any time. Account deletion purges your data within 30 days.</li>
          </ul>
        </Section>

        <Section title="Who can use JobPilot">
          <p>
            You must be at least 16. You must have legal authority to apply for
            jobs and send emails from the SMTP account you connect.
          </p>
        </Section>

        <Section title="Your account">
          <ul className="list-disc space-y-1 pl-6">
            <li>You&rsquo;re responsible for keeping your login credentials secure.</li>
            <li>Don&rsquo;t share a single account across multiple people.</li>
            <li>Notify us at <a href="mailto:security@jobapplier.app" className="text-emerald-600 underline">security@jobapplier.app</a> if you suspect unauthorized access.</li>
          </ul>
        </Section>

        <Section title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              Generate or send resumes/emails containing fabricated employment,
              education, certifications, or measurable claims you did not actually
              achieve. JobPilot&rsquo;s anti-fabrication audit will block these;
              attempts to bypass it are grounds for suspension.
            </li>
            <li>
              Send unsolicited bulk email outside of normal job application
              activity (no cold-marketing blasts, no spamming recruiter lists).
            </li>
            <li>
              Send to addresses on a known suppression list, scraped from sources
              that prohibit scraping, or to recipients who have asked you to stop.
            </li>
            <li>
              Attempt to extract API keys, decrypt other users&rsquo; data, exceed
              quotas via multiple accounts, or otherwise circumvent rate limits.
            </li>
            <li>
              Use JobPilot to harass, threaten, defame, or impersonate anyone.
            </li>
            <li>
              Reverse-engineer, scrape, or build a competing service on top of
              JobPilot&rsquo;s data without prior written permission.
            </li>
          </ul>
        </Section>

        <Section title="Free service">
          <p>
            JobPilot is provided free of charge during the MVP phase. We may add
            paid tiers in the future; if so we&rsquo;ll announce them at least 30
            days in advance and existing free-tier accounts will retain a
            grandfathered free quota.
          </p>
          <p className="mt-3">
            We enforce per-user AI quotas (token limits per day) to keep the
            service free for everyone. Hitting your quota pauses AI generation
            until midnight UTC.
          </p>
        </Section>

        <Section title="Your content">
          <p>
            You own your resume, your CV, the emails you send, and the data you
            enter. You grant JobPilot a limited license to process this content
            solely to provide the service (matching, generation, sending).
          </p>
          <p className="mt-3">
            You confirm you have the right to share any content you upload (e.g.
            that your CV is yours, that any references you cite are accurate).
          </p>
        </Section>

        <Section title="AI-generated output">
          <p>
            JobPilot uses third-party AI providers (Groq, Google Gemini) to
            generate resume content and email drafts. AI output is{" "}
            <em>suggestions</em>, not guarantees:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Always review generated content before sending</li>
            <li>The anti-fabrication audit catches the common cases but is not perfect — you remain responsible for what goes out under your name</li>
            <li>Tone, phrasing, and emphasis are AI choices you should sanity-check</li>
            <li>Job-match scores are estimates, not guarantees</li>
          </ul>
        </Section>

        <Section title="Service availability">
          <p>
            JobPilot runs on shared infrastructure (Vercel + Neon). We aim for
            high availability but make no SLA during the MVP. Planned maintenance
            is announced in-app. Unplanned outages happen; please don&rsquo;t rely
            on JobPilot for a deadline-sensitive application.
          </p>
        </Section>

        <Section title="Termination">
          <p>
            You can delete your account at any time from{" "}
            <a href="/settings#delete" className="text-emerald-600 underline">
              Settings → Delete account
            </a>
            .
          </p>
          <p className="mt-3">
            We can suspend or terminate accounts that violate these terms,
            present a security risk, or in response to a legal demand. Where
            reasonable, we&rsquo;ll notify you in advance.
          </p>
        </Section>

        <Section title="Disclaimer">
          <p>
            JOBPILOT IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY
            KIND. WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED,
            ERROR-FREE, OR THAT ANY EMAIL WILL BE DELIVERED, READ, OR REPLIED TO.
            WE DO NOT GUARANTEE JOB OUTCOMES.
          </p>
        </Section>

        <Section title="Liability">
          <p>
            To the maximum extent permitted by law, JobPilot&rsquo;s total
            liability for any claim arising out of these terms is limited to the
            amount you paid us in the prior 12 months (which, during the free
            MVP, is zero).
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These terms are governed by the laws of the Islamic Republic of
            Pakistan. Disputes will be resolved in the courts of Lahore,
            Pakistan, except where local consumer protection law requires
            otherwise.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms. Material changes will be posted here with
            a 30-day notice (or, where required by law, a longer notice). Continued
            use after the effective date constitutes acceptance.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or concerns? Email{" "}
            <a
              href="mailto:legal@jobapplier.app"
              className="text-emerald-600 underline"
            >
              legal@jobapplier.app
            </a>{" "}
            or use{" "}
            <a href="/contact" className="text-emerald-600 underline">
              /contact
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
