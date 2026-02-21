/**
 * Multi-strategy company email extraction.
 * Attempts to find a company's HR/career email from job data.
 */

const NOREPLY_FILTER = /noreply|no-reply|donotreply|example\.com|test\.com|mailinator|tempmail|spam|abuse|postmaster|mailer-daemon|bounce/i;

const GENERIC_BLACKLIST = [
  "support@", "info@", "admin@", "webmaster@", "postmaster@",
  "sales@", "marketing@", "billing@", "noreply@", "no-reply@",
  "feedback@", "newsletter@", "unsubscribe@", "help@",
];

const JOB_BOARD_DOMAINS = [
  "indeed.com", "linkedin.com", "remotive.com", "rozee.pk",
  "arbeitnow.com", "glassdoor.com", "monster.com", "ziprecruiter.com",
];

export function extractCompanyEmail(
  description: string | null,
  companyUrl: string | null,
  company: string
): string | null {
  // Strategy 1: Regex from job description
  if (description) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = description.match(emailRegex) || [];

    const priorityKeywords = ["hr", "career", "jobs", "recruit", "talent", "hiring", "apply", "work"];
    const filteredEmails = emails.filter((e) => {
      const lower = e.toLowerCase();
      return !NOREPLY_FILTER.test(lower) &&
        !GENERIC_BLACKLIST.some((bl) => lower.startsWith(bl)) &&
        !JOB_BOARD_DOMAINS.some((jb) => lower.includes(jb));
    });

    const priorityEmail = filteredEmails.find((e) =>
      priorityKeywords.some((kw) => e.toLowerCase().includes(kw))
    );
    if (priorityEmail) return priorityEmail.toLowerCase();

    if (filteredEmails.length > 0) return filteredEmails[0].toLowerCase();
  }

  // Strategy 2: Common patterns from company domain
  if (companyUrl) {
    try {
      const url = new URL(companyUrl);
      const domain = url.hostname.replace("www.", "");
      if (!JOB_BOARD_DOMAINS.some((jb) => domain.includes(jb))) {
        return `careers@${domain}`;
      }
    } catch {
      // Invalid URL
    }
  }

  // Strategy 3: Guess from company name
  const cleanName = company
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|gmbh|ag|plc|pvt|private|limited|technologies|tech|software|solutions)\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

  if (cleanName.length > 2 && cleanName.length < 30) {
    return `careers@${cleanName}.com`;
  }

  return null;
}
