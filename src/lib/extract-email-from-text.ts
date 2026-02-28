const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const EXCLUDED_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
  "aol.com", "icloud.com", "mail.com", "protonmail.com", "zoho.com",
  "linkedin.com", "facebook.com", "twitter.com", "instagram.com",
  "google.com", "example.com", "test.com", "sentry.io",
  "github.com", "stackoverflow.com", "medium.com",
]);

const EXCLUDED_PREFIXES = new Set([
  "noreply", "no-reply", "donotreply", "unsubscribe", "mailer-daemon",
  "postmaster", "bounce", "abuse", "spam", "webmaster",
  "support", "newsletter", "feedback", "help",
]);

const HIRING_PREFIXES = new Set([
  "hr", "hiring", "careers", "jobs", "recruitment", "talent",
  "apply", "resume", "cv", "people", "join", "work", "team",
  "info", "contact",
]);

const PERSONAL_PATTERN = /^[a-z]+\.[a-z]+$/;

export function extractEmailFromText(text: string): {
  email: string | null;
  confidence: number;
} {
  if (!text) return { email: null, confidence: 0 };

  const allEmails = text.match(EMAIL_REGEX) || [];
  const unique = Array.from(new Set(allEmails.map((e) => e.toLowerCase())));

  const scored: Array<{ email: string; score: number }> = [];

  for (const email of unique) {
    const [prefix, domain] = email.split("@");
    if (!prefix || !domain) continue;
    if (EXCLUDED_DOMAINS.has(domain)) continue;
    if (EXCLUDED_PREFIXES.has(prefix.split(".")[0])) continue;

    let score = 85;

    if (HIRING_PREFIXES.has(prefix.split(".")[0])) {
      score += 10;
    }

    if (PERSONAL_PATTERN.test(prefix)) {
      score -= 10;
    }

    scored.push({ email, score });
  }

  if (scored.length === 0) return { email: null, confidence: 0 };

  scored.sort((a, b) => b.score - a.score);
  return {
    email: scored[0].email,
    confidence: Math.min(scored[0].score, 95),
  };
}
