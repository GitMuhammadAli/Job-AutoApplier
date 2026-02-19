import { verifyMxRecord } from "./email-verifier";

export type EmailConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface FindCompanyEmailResult {
  email: string | null;
  confidence: EmailConfidence;
  method: string;
}

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const NOREPLY_FILTER = /noreply|no-reply|donotreply|example\.com|test\.com/i;
const HR_PREFIX = /^(hr|careers|hiring|jobs|recruit|talent|apply|people)/i;

const JOB_BOARD_DOMAINS = [
  "indeed.com",
  "linkedin.com",
  "remotive.com",
  "rozee.pk",
  "arbeitnow.com",
  "glassdoor.com",
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
    const goodEmails = emails.filter((e) => !NOREPLY_FILTER.test(e));

    if (goodEmails.length > 0) {
      const preferred = goodEmails.find((e) => HR_PREFIX.test(e));
      return {
        email: (preferred || goodEmails[0]).toLowerCase(),
        confidence: "HIGH",
        method: "job_description_regex",
      };
    }
  }

  // Strategy 2: Domain patterns + MX verification
  const domain = extractDomain(
    job.company,
    job.companyUrl || job.sourceUrl
  );
  if (domain) {
    const hasMx = await verifyMxRecord(domain);
    if (hasMx) {
      return {
        email: `careers@${domain}`,
        confidence: "MEDIUM",
        method: `pattern_guess_mx_verified (${domain})`,
      };
    }
  }

  // Strategy 3: Scrape careers page for emails
  const scrapeUrl = job.applyUrl || job.companyUrl || job.sourceUrl;
  if (scrapeUrl) {
    try {
      const companyOrigin = new URL(scrapeUrl).origin;
      const isJobBoard = JOB_BOARD_DOMAINS.some((jb) =>
        companyOrigin.includes(jb)
      );

      if (!isJobBoard) {
        const response = await fetch(`${companyOrigin}/careers`, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "Mozilla/5.0" },
        });

        if (response.ok) {
          const html = await response.text();
          const pageEmails = html.match(EMAIL_REGEX) || [];
          const filtered = pageEmails.filter((e) => !NOREPLY_FILTER.test(e));

          if (filtered.length > 0) {
            return {
              email: filtered[0].toLowerCase(),
              confidence: "MEDIUM",
              method: "careers_page_scrape",
            };
          }
        }
      }
    } catch {
      // Timeout or blocked
    }
  }

  // Strategy 4: Best guess (no verification)
  if (domain) {
    return {
      email: `careers@${domain}`,
      confidence: "LOW",
      method: "best_guess_unverified",
    };
  }

  return { email: null, confidence: "NONE", method: "none" };
}

function extractDomain(
  company: string,
  url: string | null
): string | null {
  if (url) {
    try {
      const parsed = new URL(url);
      if (!JOB_BOARD_DOMAINS.some((jb) => parsed.hostname.includes(jb))) {
        return parsed.hostname.replace("www.", "");
      }
    } catch {}
  }

  const cleaned = company
    .replace(COMPANY_SUFFIXES, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

  if (cleaned.length >= 2) return `${cleaned}.com`;
  return null;
}
