import { verifyMxRecord, verifyRecipient } from "./email-verifier";

export type EmailConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface FindCompanyEmailResult {
  email: string | null;
  confidence: EmailConfidence;
  confidenceScore: number;
  method: string;
}

const CONFIDENCE_SCORES: Record<EmailConfidence, number> = {
  HIGH: 95,
  MEDIUM: 60,
  LOW: 20,
  NONE: 0,
};

export function getConfidenceScore(confidence: EmailConfidence): number {
  return CONFIDENCE_SCORES[confidence] ?? 0;
}

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const NOREPLY_FILTER = /noreply|no-reply|donotreply|example\.com|test\.com|mailinator|tempmail|guerrillamail|throwaway|spam|abuse|postmaster|mailer-daemon|bounce/i;
const HR_PREFIX = /^(hr|careers|hiring|jobs|recruit|talent|apply|people)/i;

const GENERIC_EMAIL_BLACKLIST = [
  "support@", "info@", "admin@", "webmaster@", "postmaster@",
  "sales@", "marketing@", "billing@", "noreply@", "no-reply@",
  "feedback@", "newsletter@", "unsubscribe@", "help@",
];

const JOB_BOARD_DOMAINS = [
  "indeed.com",
  "linkedin.com",
  "remotive.com",
  "rozee.pk",
  "arbeitnow.com",
  "glassdoor.com",
  "bebee.com",
  "itjobsinpakistan.com",
  "monster.com",
  "ziprecruiter.com",
  "careerbuilder.com",
  "simplyhired.com",
  "dice.com",
  "naukri.com",
  "seek.com",
  "totaljobs.com",
  "reed.co.uk",
  "cwjobs.co.uk",
  "stepstone.de",
  "xing.com",
  "bayt.com",
  "wuzzuf.net",
  "mustakbil.com",
  "jobsdb.com",
  "jobstreet.com",
  "jora.com",
  "adzuna.com",
  "adzuna.co.uk",
  "wellfound.com",
  "angel.co",
  "hired.com",
  "builtin.com",
  "lever.co",
  "greenhouse.io",
  "workday.com",
  "jsearch.com",
  "google.com",
  "jooble.org",
  "neuvoo.com",
  "talent.com",
];

const COMPANY_SUFFIXES =
  /\s+(inc|llc|ltd|corp|co|gmbh|ag|plc|pvt|private|limited|technologies|tech|software|solutions|group|international)\.?$/i;

export async function findCompanyEmail(job: {
  description: string | null;
  company: string;
  sourceUrl: string | null;
  applyUrl: string | null;
  companyUrl?: string | null;
}): Promise<FindCompanyEmailResult> {
  // Strategy 1: Regex from job description
  if (job.description) {
    const emails = job.description.match(EMAIL_REGEX) || [];
    const goodEmails = emails.filter(
      (e) => !NOREPLY_FILTER.test(e) && !GENERIC_EMAIL_BLACKLIST.some((bl) => e.toLowerCase().startsWith(bl))
    );

    if (goodEmails.length > 0) {
      const preferred = goodEmails.find((e) => HR_PREFIX.test(e));
      return {
        email: (preferred || goodEmails[0]).toLowerCase(),
        confidence: "HIGH",
        confidenceScore: CONFIDENCE_SCORES.HIGH,
        method: "job_description_regex",
      };
    }
  }

  // Strategy 2: Scrape careers page for real emails
  const scrapeUrl = job.applyUrl || job.companyUrl || job.sourceUrl;
  if (scrapeUrl) {
    try {
      const companyOrigin = new URL(scrapeUrl).origin;
      const originHost = new URL(companyOrigin).hostname;
      const isJobBoard = isJobBoardDomain(originHost);

      if (!isJobBoard) {
        const pagesToTry = ["/careers", "/contact", "/jobs", "/about"];
        for (const page of pagesToTry) {
          try {
            const response = await fetch(`${companyOrigin}${page}`, {
              signal: AbortSignal.timeout(5000),
              headers: { "User-Agent": "Mozilla/5.0" },
            });

            if (response.ok) {
              const html = await response.text();
              const pageEmails = html.match(EMAIL_REGEX) || [];
              const filtered = pageEmails.filter(
                (e) =>
                  !NOREPLY_FILTER.test(e) &&
                  !GENERIC_EMAIL_BLACKLIST.some((bl) => e.toLowerCase().startsWith(bl))
              );

              if (filtered.length > 0) {
                const hrEmail = filtered.find((e) => HR_PREFIX.test(e));
                return {
                  email: (hrEmail || filtered[0]).toLowerCase(),
                  confidence: "HIGH",
                  confidenceScore: 80,
                  method: `scraped_from_${page.slice(1)}_page`,
                };
              }
            }
          } catch {
            // Page not found or blocked — try next
          }
        }
      }
    } catch {
      // Invalid URL
    }
  }

  // Strategy 3: Domain + MX verified + RCPT TO verified pattern guess
  // Only returns the email if the mail server confirms the mailbox exists
  const domain = extractDomain(
    job.company,
    job.companyUrl || job.sourceUrl
  );
  if (domain) {
    const hasMx = await verifyMxRecord(domain);
    if (hasMx) {
      const PREFIXES_TO_TRY = ["careers", "hr", "jobs", "hiring", "apply"] as const;
      for (const prefix of PREFIXES_TO_TRY) {
        const candidateEmail = `${prefix}@${domain}`;
        const result = await verifyRecipient(candidateEmail);
        if (result.exists) {
          return {
            email: candidateEmail,
            confidence: "LOW",
            confidenceScore: 40,
            method: `pattern_guess_rcpt_verified (${prefix}@${domain})`,
          };
        }
      }
      // MX exists but no common prefix accepted — don't guess blindly
      console.log(`[EmailExtractor] ${domain}: MX exists but no common mailbox prefix accepted`);
    }
  }

  return { email: null, confidence: "NONE", confidenceScore: 0, method: "none" };
}

function isJobBoardDomain(hostname: string): boolean {
  const h = hostname.toLowerCase().replace("www.", "");
  return JOB_BOARD_DOMAINS.some((jb) => h === jb || h.endsWith(`.${jb}`));
}

function extractDomain(
  company: string,
  url: string | null
): string | null {
  if (url) {
    try {
      const parsed = new URL(url);
      if (!isJobBoardDomain(parsed.hostname)) {
        return parsed.hostname.replace("www.", "");
      }
    } catch {
      // Invalid URL — fall through to domain guess
    }
  }

  const cleaned = company
    .replace(COMPANY_SUFFIXES, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

  // M2: Only guess .com for names that look like plausible domain prefixes
  // Skip if too short, too long, or contains no vowels (likely abbreviation or non-Latin)
  if (cleaned.length >= 3 && cleaned.length <= 30 && /[aeiou]/.test(cleaned)) {
    return `${cleaned}.com`;
  }
  return null;
}
