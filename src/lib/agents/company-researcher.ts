import Groq from "groq-sdk";

interface CompanyProfile {
  name: string;
  mission: string;
  values: string[];
  techStack: string[];
  culture: string;
  size: string;
  recentNews: string[];
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function researchCompany(companyName: string): Promise<CompanyProfile> {
  const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_CSE_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(companyName + " company about careers tech stack")}&num=3`;

  let searchContext = "";
  try {
    const res = await fetch(searchUrl);
    const data = await res.json();
    const snippets = (data.items ?? []).slice(0, 3).map((item: any) =>
      `${item.title}: ${item.snippet}`
    );
    searchContext = snippets.join("\n");
  } catch {
    searchContext = `Company: ${companyName}`;
  }

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content: `Extract company information from search results. Return JSON only:
{"mission":"one sentence","values":["v1","v2"],"techStack":["t1","t2"],"culture":"brief","size":"startup/small/medium/large/enterprise","recentNews":["item"]}
If info unavailable, use reasonable defaults.`,
      },
      { role: "user", content: `Company: ${companyName}\n\nSearch results:\n${searchContext}` },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return {
      name: companyName,
      mission: parsed.mission ?? "",
      values: parsed.values ?? [],
      techStack: parsed.techStack ?? [],
      culture: parsed.culture ?? "",
      size: parsed.size ?? "unknown",
      recentNews: parsed.recentNews ?? [],
    };
  } catch {
    return { name: companyName, mission: "", values: [], techStack: [], culture: "", size: "unknown", recentNews: [] };
  }
}
