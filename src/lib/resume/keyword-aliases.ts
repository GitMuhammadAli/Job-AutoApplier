/**
 * Keyword alias / canonical-form mapping.
 *
 * The semantic distinction vs keyword-adjacency.ts:
 *   - Aliases: same thing, different name. "k8s" = "kubernetes". If the JD
 *     says "k8s" and the candidate's profile says "Kubernetes", that's
 *     covered, not adjacent.
 *   - Adjacencies: different things, related skills. "webrtc" ≈ "socket.io".
 *     The candidate has experience in a similar problem space but the
 *     skills are genuinely distinct.
 *
 * Without this layer, the coverage panel falsely flags K8s as ❌ missing
 * even when the candidate's profile has Kubernetes spelled out. That
 * destroys trust in the rest of the signal.
 *
 * Rules:
 *   - Lowercase canonical form on both sides.
 *   - One alias → multiple canonicals is allowed (e.g. "ts" could match
 *     both "typescript" and rare "test suite"). Caller treats the list as
 *     "OR" — any haystack hit counts.
 *   - The relationship is bidirectional in expandKeywordVariants: if the
 *     map has "k8s" → ["kubernetes"], then querying for "kubernetes" also
 *     expands back to "k8s". This way the same map serves both directions.
 */

const RAW_ALIASES: Record<string, string[]> = {
  // ── Cloud / infra ────────────────────────────────────────────────
  "k8s": ["kubernetes"],
  "tf": ["terraform"], // can also be tensorflow; we accept ambiguity in either direction
  "iac": ["infrastructure as code", "terraform", "pulumi", "cloudformation"],
  "vpc": ["virtual private cloud"],
  "k3s": ["kubernetes"], // K3s is a Kubernetes distribution
  "argo": ["argocd"],

  // ── Languages / acronyms ─────────────────────────────────────────
  "ts": ["typescript"],
  "js": ["javascript"],
  "py": ["python"],
  "go": ["golang"],
  "rb": ["ruby"],
  "c#": ["csharp", "c sharp", "dotnet", ".net"],
  "c++": ["cpp", "c plus plus"],
  "obj-c": ["objective-c", "objective c"],

  // ── AI/ML ────────────────────────────────────────────────────────
  "ml": ["machine learning"],
  "ai": ["artificial intelligence"],
  "nlp": ["natural language processing"],
  "cv": ["computer vision"], // ambiguous w/ "cv" = curriculum vitae; we accept it
  "llm": ["large language model", "large language models"],
  "llms": ["large language models", "large language model", "llm"],
  "rag": ["retrieval augmented generation", "retrieval-augmented generation"],
  "rl": ["reinforcement learning"],
  "rlhf": ["reinforcement learning from human feedback"],
  "gan": ["generative adversarial network"],

  // ── Frontend ─────────────────────────────────────────────────────
  "rn": ["react native"],
  "nextjs": ["next.js", "next js"],
  "nuxtjs": ["nuxt.js", "nuxt js"],
  "vuejs": ["vue.js", "vue js"],
  "nodejs": ["node.js", "node js"],

  // ── Frameworks ───────────────────────────────────────────────────
  "spa": ["single page application", "single-page application"],
  "ssr": ["server side rendering", "server-side rendering"],
  "ssg": ["static site generation", "static-site generation"],

  // ── Methodologies / process ──────────────────────────────────────
  "ci/cd": ["cicd", "continuous integration", "continuous deployment", "continuous delivery"],
  "cicd": ["ci/cd", "continuous integration", "continuous deployment"],
  "tdd": ["test driven development", "test-driven development"],
  "bdd": ["behavior driven development", "behavior-driven development"],
  "ddd": ["domain driven design", "domain-driven design"],
  "kpis": ["kpi", "key performance indicators"],

  // ── DB / data ────────────────────────────────────────────────────
  "psql": ["postgresql", "postgres"],
  "pg": ["postgresql", "postgres"],
  "mssql": ["sql server", "microsoft sql server", "ms sql"],
  "etl": ["extract transform load"],
  "elt": ["extract load transform"],

  // ── Web / protocols ──────────────────────────────────────────────
  "ws": ["websocket", "websockets"],
  "websocket": ["websockets", "ws"],
  "rest": ["restful", "rest api"],
  "gql": ["graphql"],

  // ── Auth ─────────────────────────────────────────────────────────
  "oauth2": ["oauth", "oauth 2.0"],
  "oidc": ["openid connect"],
  "sso": ["single sign-on", "single sign on"],
  "2fa": ["two factor authentication", "two-factor authentication", "mfa"],
  "mfa": ["multi factor authentication", "multi-factor authentication", "2fa"],

  // ── Mobile ───────────────────────────────────────────────────────
  "ios": ["i o s"], // some JDs write "iOS" oddly
  "android": ["android sdk"],

  // ── Salesforce / enterprise ──────────────────────────────────────
  "crm": ["customer relationship management"],
  "erp": ["enterprise resource planning"],
  "saas": ["software as a service", "software-as-a-service"],
  "paas": ["platform as a service", "platform-as-a-service"],
  "iaas": ["infrastructure as a service", "infrastructure-as-a-service"],

  // ── Common dotted/spaced variants ────────────────────────────────
  "node.js": ["nodejs", "node js"],
  "next.js": ["nextjs", "next js"],
  "vue.js": ["vuejs", "vue js"],
  "nuxt.js": ["nuxtjs", "nuxt js"],
};

// Build a bidirectional lookup map at module-init time. For each (alias →
// canonicals), we also map every canonical back to the alias so callers can
// query in either direction. Keys + values are lowercase + trimmed.
const norm = (s: string) => s.toLowerCase().trim();
const BIDIRECTIONAL = new Map<string, Set<string>>();

for (const [key, vals] of Object.entries(RAW_ALIASES)) {
  const k = norm(key);
  if (!BIDIRECTIONAL.has(k)) BIDIRECTIONAL.set(k, new Set());
  for (const v of vals) {
    const vn = norm(v);
    BIDIRECTIONAL.get(k)!.add(vn);
    if (!BIDIRECTIONAL.has(vn)) BIDIRECTIONAL.set(vn, new Set());
    BIDIRECTIONAL.get(vn)!.add(k);
  }
}

/**
 * Given a keyword, return all alias/canonical forms worth checking — always
 * includes the original keyword itself. Empty/whitespace-only input returns
 * an empty array.
 *
 * Examples:
 *   "k8s"        → ["k8s", "kubernetes"]
 *   "kubernetes" → ["kubernetes", "k8s"]
 *   "react"      → ["react"]   (no alias entry, returns just original)
 */
export function expandKeywordVariants(keyword: string): string[] {
  const k = norm(keyword);
  if (!k) return [];
  const expanded = BIDIRECTIONAL.get(k);
  if (!expanded) return [k];
  return [k, ...Array.from(expanded)];
}

/**
 * Does the haystack contain the keyword or any of its alias variants?
 * Case-insensitive substring check. Returns the matched variant for
 * debugging / UI display, or null when no variant landed.
 */
export function haystackContainsKeyword(
  haystack: string,
  keyword: string,
): string | null {
  const hLower = haystack.toLowerCase();
  for (const variant of expandKeywordVariants(keyword)) {
    if (hLower.includes(variant)) return variant;
  }
  return null;
}
