/**
 * Agent 1: Company Researcher
 * Input: company name
 * Output: { mission, values, techStack, recentNews, culture }
 * Uses Google CSE to search for company info, then extracts key info with Groq.
 */

import { generateWithGroq } from "@/lib/groq";

export interface CompanyResearch {
  mission: string;
  values: string[];
  techStack: string[];
  recentNews: string;
  culture: string;
}

interface GoogleSearchResult {
  title: string;
  snippet: string;
  link: string;
}

async function searchGoogle(query: string): Promise<GoogleSearchResult[]> {
  const apiKey = process.env.GOOGLE_CSE_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cseId) {
    return [];
  }

  try {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", cseId);
    url.searchParams.set("q", query);
    url.searchParams.set("num", "3");

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.items ?? []).map((item: { title: string; snippet: string; link: string }) => ({
      title: item.title ?? "",
      snippet: item.snippet ?? "",
      link: item.link ?? "",
    }));
  } catch {
    return [];
  }
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobPilot/1.0)" },
    });
    if (!response.ok) return "";
    const html = await response.text();
    // Strip HTML tags and collapse whitespace
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .slice(0, 3000);
  } catch {
    return "";
  }
}

export async function researchCompany(companyName: string): Promise<CompanyResearch> {
  const query = `${companyName} about careers tech stack company culture`;
  const results = await searchGoogle(query);

  let pageContent = "";
  if (results.length > 0) {
    pageContent = await fetchPageContent(results[0].link);
  }

  const snippets = results
    .map((r) => `${r.title}: ${r.snippet}`)
    .join("\n");

  const context = [
    snippets ? `Search snippets:\n${snippets}` : "",
    pageContent ? `Page content:\n${pageContent}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const systemPrompt = `You are a company research analyst. Extract key information about a company from the provided context.
Return ONLY valid JSON with no markdown or explanation.
If information is not found, make a reasonable educated guess based on the company name and industry.

JSON format:
{
  "mission": "company mission statement or purpose (1-2 sentences)",
  "values": ["value1", "value2", "value3"],
  "techStack": ["tech1", "tech2", "tech3"],
  "recentNews": "brief summary of recent news or developments (1-2 sentences)",
  "culture": "brief description of company culture (1-2 sentences)"
}`;

  const userPrompt = `Company: ${companyName}

${context || "No search results found. Please infer based on company name."}

Extract company research. Return ONLY JSON.`;

  const raw = await generateWithGroq(systemPrompt, userPrompt, {
    temperature: 0.3,
    max_tokens: 600,
    model: "llama-3.1-8b-instant",
  });

  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as CompanyResearch;
    return {
      mission: parsed.mission ?? "",
      values: Array.isArray(parsed.values) ? parsed.values : [],
      techStack: Array.isArray(parsed.techStack) ? parsed.techStack : [],
      recentNews: parsed.recentNews ?? "",
      culture: parsed.culture ?? "",
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      mission: `${companyName} is committed to delivering innovative solutions.`,
      values: ["Innovation", "Collaboration", "Excellence"],
      techStack: [],
      recentNews: "No recent news found.",
      culture: "Professional and collaborative work environment.",
    };
  }
}
