/**
 * Company email extraction with confidence scoring.
 * Returns { email, confidence, method } for use in auto-apply logic.
 */

export type EmailConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface FindCompanyEmailResult {
  email: string;
  confidence: EmailConfidence;
  method: string;
}

export function findCompanyEmail(
  description: string | null,
  companyUrl: string | null,
  company: string
): FindCompanyEmailResult | null {
  // Strategy 1: Regex from job description
  if (description) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = description.match(emailRegex) || [];

    // Prefer HR/careers/jobs/recruitment emails — HIGH confidence
    const priorityKeywords = ["hr", "career", "jobs", "recruit", "talent", "hiring", "apply", "work"];
    const priorityEmail = emails.find((e) =>
      priorityKeywords.some((kw) => e.toLowerCase().includes(kw))
    );
    if (priorityEmail) {
      return {
        email: priorityEmail.toLowerCase(),
        confidence: "HIGH",
        method: "description_priority_keyword",
      };
    }

    // Filter out common non-company emails
    const filteredEmails = emails.filter((e) => {
      const lower = e.toLowerCase();
      return !lower.includes("noreply") &&
             !lower.includes("no-reply") &&
             !lower.includes("example.com") &&
             !lower.includes("test.com");
    });

    if (filteredEmails.length > 0) {
      return {
        email: filteredEmails[0].toLowerCase(),
        confidence: "MEDIUM",
        method: "description_regex",
      };
    }
  }

  // Strategy 2: Common patterns from company domain — MEDIUM confidence
  if (companyUrl) {
    try {
      const url = new URL(companyUrl);
      const domain = url.hostname.replace("www.", "");
      return {
        email: `careers@${domain}`,
        confidence: "MEDIUM",
        method: "company_url_domain",
      };
    } catch {
      // Invalid URL
    }
  }

  // Strategy 3: Guess from company name — LOW confidence
  const cleanName = company
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");

  if (cleanName.length > 2 && cleanName.length < 30) {
    return {
      email: `careers@${cleanName}.com`,
      confidence: "LOW",
      method: "company_name_guess",
    };
  }

  return null;
}
