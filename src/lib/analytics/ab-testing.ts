import Groq from "groq-sdk";

let _groq: Groq | null = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

interface ABVariants { variantA: string; variantB: string; }

export async function generateSubjectVariants(
  jobTitle: string, company: string, topSkill: string,
): Promise<ABVariants> {
  const completion = await getGroq().chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content: `Generate 2 email subject line variants for a job application.
Variant A: Direct and skill-focused (mentions a specific skill)
Variant B: Value-focused (what you'll bring to the company)
Both under 60 chars, professional, no clickbait.
Return JSON: {"variantA":"...","variantB":"..."}`,
      },
      { role: "user", content: `Position: ${jobTitle} at ${company}\nTop skill: ${topSkill}` },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return {
      variantA: parsed.variantA ?? `${topSkill} Developer — ${jobTitle} Application`,
      variantB: parsed.variantB ?? `Application for ${jobTitle} at ${company}`,
    };
  } catch {
    return {
      variantA: `${topSkill} Developer — ${jobTitle} Application`,
      variantB: `Application for ${jobTitle} at ${company}`,
    };
  }
}

export function pickVariant(variants: ABVariants): { subject: string; variant: "A" | "B" } {
  const isA = Math.random() < 0.5;
  return { subject: isA ? variants.variantA : variants.variantB, variant: isA ? "A" : "B" };
}

export function analyzeABResults(results: Array<{ variant: "A" | "B"; opened: boolean; replied: boolean }>) {
  const a = results.filter(r => r.variant === "A");
  const b = results.filter(r => r.variant === "B");

  const aOpenRate = a.length > 0 ? a.filter(r => r.opened).length / a.length : 0;
  const bOpenRate = b.length > 0 ? b.filter(r => r.opened).length / b.length : 0;
  const significant = a.length >= 30 && b.length >= 30;

  return {
    variantA: { count: a.length, openRate: Math.round(aOpenRate * 100), replyRate: Math.round(a.length > 0 ? a.filter(r => r.replied).length / a.length * 100 : 0) },
    variantB: { count: b.length, openRate: Math.round(bOpenRate * 100), replyRate: Math.round(b.length > 0 ? b.filter(r => r.replied).length / b.length * 100 : 0) },
    winner: aOpenRate > bOpenRate ? "A" as const : bOpenRate > aOpenRate ? "B" as const : "tie" as const,
    significant,
    recommendation: significant
      ? `Variant ${aOpenRate > bOpenRate ? "A (skill-focused)" : "B (value-focused)"} performs better. ${Math.round(Math.abs(aOpenRate - bOpenRate) * 100)}% higher open rate.`
      : `Need ${30 - Math.min(a.length, b.length)} more data points for significance.`,
  };
}
