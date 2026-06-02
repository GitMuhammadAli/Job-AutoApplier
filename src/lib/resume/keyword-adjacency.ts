/**
 * Curated tech adjacency map.
 *
 * When a JD asks for keyword K that the user doesn't have, we look up K here
 * to find related tech the user MIGHT have in their profile. This is the
 * honest helper for the "JD wants X, I don't have X" case — instead of
 * telling the user "tough luck, we won't fabricate", we surface their actual
 * adjacent experience so THEY can decide whether to mention it.
 *
 * Rules for entries:
 *   - One direction only: K → [related]. Bidirectional lookup is in the
 *     finder function, not duplicated in the data.
 *   - "Related" means "an engineer claiming K could plausibly know R", not
 *     "the words look similar". e.g. WebRTC → Socket.IO is valid (both
 *     real-time bidi comms); WebRTC → REST is not (totally different model).
 *   - Keep aliases tight. If a user has Tailwind, we don't claim that
 *     proves CSS expertise — but if user has CSS, we don't claim that
 *     proves Tailwind. Asymmetry is intentional.
 *   - Keys + values are lowercase, normalized form. Match against profile
 *     uses lowercase substring.
 *
 * NOT IN SCOPE: stem matching ("k8s" ↔ "kubernetes"). That belongs in a
 * separate alias table used by extractJdKeywords too. This table is purely
 * "different things that signal overlapping experience."
 */

import type { ResumeProfile } from "./types";

// Source of truth — keep keys sorted alphabetically for diff reviews.
const ADJACENCY: Record<string, string[]> = {
  // ── Real-time / messaging ─────────────────────────────────────────
  "webrtc": ["websockets", "socket.io", "peer-to-peer", "p2p", "stun", "turn", "ice", "sfu", "webtransport", "webrtc-adapter"],
  "websockets": ["socket.io", "webrtc", "long-polling", "sse", "server-sent events"],
  "socket.io": ["websockets", "webrtc", "real-time", "pub/sub"],
  "sse": ["websockets", "long-polling", "server-sent events"],
  "kafka": ["rabbitmq", "redis streams", "nats", "pulsar", "event streaming", "pub/sub"],
  "rabbitmq": ["kafka", "redis", "amqp", "celery", "pub/sub"],
  "pub/sub": ["kafka", "rabbitmq", "redis", "nats"],

  // ── State / data layer ────────────────────────────────────────────
  "redux": ["zustand", "mobx", "recoil", "context api", "jotai"],
  "zustand": ["redux", "mobx", "jotai", "context api"],
  "react query": ["swr", "tanstack query", "apollo client", "urql"],
  "swr": ["react query", "tanstack query", "apollo client"],
  "tanstack query": ["react query", "swr", "apollo client"],

  // ── GraphQL ecosystem ─────────────────────────────────────────────
  "graphql": ["rest", "trpc", "apollo", "relay", "urql", "hasura"],
  "apollo": ["graphql", "urql", "relay", "react query"],
  "apollo client": ["graphql", "urql", "react query", "swr"],
  "relay": ["graphql", "apollo"],
  "hasura": ["graphql", "postgres", "supabase"],

  // ── ORM / DB ───────────────────────────────────────────────────────
  "prisma": ["drizzle", "typeorm", "sequelize", "knex", "postgres", "mysql"],
  "drizzle": ["prisma", "knex", "postgres"],
  "typeorm": ["prisma", "sequelize", "knex"],
  "sequelize": ["prisma", "typeorm", "knex"],
  "postgres": ["mysql", "supabase", "neon", "rds", "cockroachdb"],
  "postgresql": ["postgres", "mysql", "supabase", "neon"],
  "mongodb": ["dynamodb", "firestore", "couchdb"],
  "supabase": ["postgres", "firebase", "neon"],
  "firebase": ["supabase", "firestore", "amplify"],

  // ── Cloud / infra ─────────────────────────────────────────────────
  "kubernetes": ["docker", "helm", "ecs", "nomad", "k3s", "openshift"],
  "k8s": ["kubernetes", "docker", "helm"],
  "docker": ["containerd", "podman", "docker-compose"],
  "terraform": ["pulumi", "cloudformation", "cdk", "ansible"],
  "aws": ["gcp", "azure", "cloudflare workers"],
  "gcp": ["aws", "azure", "firebase"],
  "lambda": ["cloud functions", "azure functions", "vercel functions", "cloudflare workers"],
  "ecs": ["kubernetes", "fargate", "ec2"],
  "argocd": ["flux", "kubernetes", "gitops"],

  // ── Frontend frameworks ───────────────────────────────────────────
  "next.js": ["remix", "gatsby", "nuxt", "sveltekit", "react"],
  "react native": ["expo", "flutter", "react", "ionic"],
  "expo": ["react native", "react"],
  "vue": ["nuxt", "react", "svelte"],
  "svelte": ["sveltekit", "vue", "react"],
  "remix": ["next.js", "react"],
  "astro": ["next.js", "gatsby", "remix"],

  // ── CSS ───────────────────────────────────────────────────────────
  "tailwind": ["tailwindcss", "css", "styled-components", "emotion", "vanilla-extract"],
  "styled-components": ["emotion", "css", "tailwind"],
  "emotion": ["styled-components", "css", "tailwind"],

  // ── Auth ──────────────────────────────────────────────────────────
  "oauth": ["oauth2", "openid connect", "saml", "jwt", "auth0", "clerk", "nextauth"],
  "oauth2": ["oauth", "openid connect", "jwt"],
  "saml": ["oauth", "openid connect", "sso"],
  "jwt": ["oauth", "sessions", "cookies"],
  "auth0": ["clerk", "supabase auth", "firebase auth", "okta", "nextauth"],
  "clerk": ["auth0", "supabase auth", "firebase auth", "nextauth"],

  // ── Testing ───────────────────────────────────────────────────────
  "jest": ["vitest", "mocha", "ava", "node:test"],
  "vitest": ["jest", "mocha"],
  "playwright": ["cypress", "puppeteer", "selenium"],
  "cypress": ["playwright", "selenium", "puppeteer"],
  "puppeteer": ["playwright", "selenium"],

  // ── CI / DevOps ───────────────────────────────────────────────────
  "github actions": ["circleci", "gitlab ci", "jenkins", "buildkite"],
  "circleci": ["github actions", "gitlab ci", "jenkins"],
  "jenkins": ["github actions", "circleci", "gitlab ci"],
  "ci/cd": ["github actions", "circleci", "jenkins", "gitlab ci"],

  // ── AI / ML ───────────────────────────────────────────────────────
  "langchain": ["llamaindex", "openai", "anthropic", "vector db", "rag"],
  "llamaindex": ["langchain", "openai", "rag", "vector db"],
  "openai": ["anthropic", "groq", "gemini", "llm", "chatgpt"],
  "anthropic": ["openai", "groq", "claude", "llm"],
  "rag": ["vector db", "embeddings", "langchain", "llamaindex", "pinecone", "weaviate"],
  "vector db": ["pinecone", "weaviate", "qdrant", "chromadb", "pgvector", "embeddings"],
  "pinecone": ["weaviate", "qdrant", "chromadb", "pgvector"],
  "pgvector": ["pinecone", "weaviate", "qdrant", "embeddings"],
  "ml": ["machine learning", "tensorflow", "pytorch", "scikit-learn"],
  "machine learning": ["ml", "tensorflow", "pytorch", "scikit-learn"],
  "tensorflow": ["pytorch", "keras", "scikit-learn"],
  "pytorch": ["tensorflow", "keras", "scikit-learn"],

  // ── Backend frameworks ────────────────────────────────────────────
  "nestjs": ["express", "fastify", "koa"],
  "express": ["nestjs", "fastify", "koa", "hono"],
  "fastify": ["express", "nestjs", "hono"],
  "django": ["flask", "fastapi", "rails", "laravel"],
  "fastapi": ["django", "flask", "express"],
  "flask": ["fastapi", "django", "express"],
  "rails": ["django", "laravel", "express"],

  // ── Mobile ────────────────────────────────────────────────────────
  "swiftui": ["uikit", "react native", "flutter"],
  "kotlin": ["java", "android", "swift"],
  "flutter": ["react native", "expo", "swiftui"],

  // ── Observability ─────────────────────────────────────────────────
  "datadog": ["new relic", "grafana", "honeycomb", "sentry", "prometheus"],
  "grafana": ["datadog", "prometheus", "new relic"],
  "prometheus": ["grafana", "datadog", "metrics"],
  "sentry": ["datadog", "honeycomb", "rollbar"],
  "opentelemetry": ["datadog", "honeycomb", "jaeger", "prometheus"],

  // ── Payments ──────────────────────────────────────────────────────
  "stripe": ["paddle", "braintree", "paypal", "lemon squeezy"],
  "paddle": ["stripe", "lemon squeezy"],

  // ── Misc ───────────────────────────────────────────────────────────
  "grpc": ["protobuf", "rest", "trpc", "graphql"],
  "trpc": ["grpc", "graphql", "rest"],
  "websocket": ["websockets", "socket.io", "sse"], // singular alias for safety
};

/** Lowercase + trim. We don't try to canonicalize beyond that here. */
function norm(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * For a missing JD keyword, return the user's profile entries that are
 * adjacent to it — i.e. things the user has that signal experience in
 * the same problem space.
 *
 * Returns matched skills + matched project ids. Empty when neither the
 * keyword has an adjacency entry nor the user has anything related.
 */
export function findAdjacenciesForKeyword(
  missingKeyword: string,
  profile: ResumeProfile,
): { adjacentSkills: string[]; adjacentProjectIds: string[]; relatedTerms: string[] } {
  const k = norm(missingKeyword);
  const related = ADJACENCY[k] ?? [];
  if (related.length === 0) {
    return { adjacentSkills: [], adjacentProjectIds: [], relatedTerms: [] };
  }

  const relatedSet = new Set(related.map(norm));
  const adjacentSkills: string[] = [];
  const adjacentProjectIds: string[] = [];

  // Skills — exact lowercase substring match against the related-term list.
  // Substring lets "Apollo Client" in profile match "apollo client" in
  // ADJACENCY, but also "react query" (profile) match "react query" target.
  const relatedList = Array.from(relatedSet);
  for (const s of profile.skills) {
    const sNorm = norm(s);
    if (relatedSet.has(sNorm)) {
      adjacentSkills.push(s);
      continue;
    }
    // Also catch partial — "Apollo" in profile when target is "apollo client".
    for (const r of relatedList) {
      if (sNorm.includes(r) || r.includes(sNorm)) {
        adjacentSkills.push(s);
        break;
      }
    }
  }

  // Projects — check bullets + stack + title + oneLiner for any related term.
  for (const p of profile.projects) {
    if (!p.id) continue;
    const haystack = [
      p.title,
      p.role ?? "",
      p.oneLiner,
      ...(p.bullets ?? []),
      ...(p.stack ?? []),
    ]
      .join(" ")
      .toLowerCase();
    if (relatedList.some((r) => haystack.includes(r))) {
      adjacentProjectIds.push(p.id);
    }
  }

  return {
    adjacentSkills: dedupeStrings(adjacentSkills),
    adjacentProjectIds: dedupeStrings(adjacentProjectIds),
    relatedTerms: related,
  };
}

function dedupeStrings(items: string[]): string[] {
  return Array.from(new Set(items));
}

export interface MissingKeywordWithAdjacency {
  keyword: string;
  /** Skills user has that signal experience adjacent to this keyword. */
  adjacentSkills: string[];
  /** Project ids whose content carries adjacent tech. */
  adjacentProjectIds: string[];
  /** All terms ADJACENCY considers related — not all of them are in profile. */
  relatedTerms: string[];
  /** Has any adjacency surfaced for this keyword? */
  hasAdjacency: boolean;
}

/**
 * Bulk wrapper — run findAdjacenciesForKeyword across an array of missing
 * keywords and skip the ones with zero adjacencies surfaced. Caller's
 * coverage UI shows the adjacency strip per ❌ chip only when there's
 * something useful to say.
 */
export function findAdjacencies(
  missingKeywords: string[],
  profile: ResumeProfile,
): MissingKeywordWithAdjacency[] {
  return missingKeywords.map((kw) => {
    const r = findAdjacenciesForKeyword(kw, profile);
    return {
      keyword: kw,
      adjacentSkills: r.adjacentSkills,
      adjacentProjectIds: r.adjacentProjectIds,
      relatedTerms: r.relatedTerms,
      hasAdjacency: r.adjacentSkills.length > 0 || r.adjacentProjectIds.length > 0,
    };
  });
}
