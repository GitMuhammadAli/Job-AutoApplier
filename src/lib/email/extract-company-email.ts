/**
 * Multi-strategy company email extraction.
 * Attempts to find a company's HR/career email from job data.
 */

export function extractCompanyEmail(
  description: string | null,
  companyUrl: string | null,
  company: string
): string | null {
  // Strategy 1: Regex from job description
  if (description) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = description.match(emailRegex) || [];

    // Prefer HR/careers/jobs/recruitment emails
    const priorityKeywords = ["hr", "career", "jobs", "recruit", "talent", "hiring", "apply", "work"];
    const priorityEmail = emails.find((e) =>
      priorityKeywords.some((kw) => e.toLowerCase().includes(kw))
    );
    if (priorityEmail) return priorityEmail.toLowerCase();

    // Filter out common non-company emails
    const filteredEmails = emails.filter((e) => {
      const lower = e.toLowerCase();
      return !lower.includes("noreply") &&
             !lower.includes("no-reply") &&
             !lower.includes("example.com") &&
             !lower.includes("test.com");
    });

    if (filteredEmails.length > 0) return filteredEmails[0].toLowerCase();
  }

  // Strategy 2: Common patterns from company domain
  if (companyUrl) {
    try {
      const url = new URL(companyUrl);
      const domain = url.hostname.replace("www.", "");
      return `careers@${domain}`;
    } catch {
      // Invalid URL
    }
  }

  // Strategy 3: Guess from company name
  const cleanName = company
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");

  if (cleanName.length > 2 && cleanName.length < 30) {
    return `careers@${cleanName}.com`;
  }

  return null;
}
