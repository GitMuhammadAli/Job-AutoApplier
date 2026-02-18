export type PdfQuality = "good" | "poor" | "empty";

export async function extractText(
  buffer: Buffer,
  fileType: string
): Promise<{ text: string; quality: PdfQuality }> {
  try {
    if (fileType === "pdf") {
      return await extractTextFromPDF(buffer);
    } else if (fileType === "docx") {
      return await extractTextFromDOCX(buffer);
    } else if (fileType === "txt") {
      const text = buffer.toString("utf-8");
      return { text, quality: assessQuality(text) };
    }
    return { text: "", quality: "empty" };
  } catch (error) {
    console.error("Text extraction error:", error);
    return { text: "", quality: "empty" };
  }
}

export async function extractTextFromPDF(
  buffer: Buffer
): Promise<{ text: string; quality: PdfQuality }> {
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as Record<string, unknown>).default || pdfParseModule;
    const data = await (pdfParse as (b: Buffer) => Promise<{ text: string }>)(buffer);
    const text = data.text || "";
    return { text, quality: assessQuality(text) };
  } catch (error) {
    console.error("PDF parse error:", error);
    return { text: "", quality: "empty" };
  }
}

async function extractTextFromDOCX(
  buffer: Buffer
): Promise<{ text: string; quality: PdfQuality }> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || "";
    return { text, quality: assessQuality(text) };
  } catch (error) {
    console.error("DOCX parse error:", error);
    return { text: "", quality: "empty" };
  }
}

function assessQuality(text: string): PdfQuality {
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount < 50) return "empty";

  const printable = text.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
  const printableRatio = text.length > 0 ? printable.length / text.length : 0;
  if (printableRatio < 0.5) return "poor";

  return "good";
}

const SKILL_ALIASES: Record<string, string[]> = {
  React: ["React", "React.js", "ReactJS"],
  Vue: ["Vue", "Vue.js", "VueJS"],
  Angular: ["Angular", "AngularJS"],
  "Next.js": ["Next.js", "NextJS", "Next"],
  "Node.js": ["Node.js", "NodeJS"],
  Express: ["Express", "Express.js", "ExpressJS"],
  NestJS: ["NestJS", "Nest.js"],
  TypeScript: ["TypeScript", "TS"],
  JavaScript: ["JavaScript", "JS", "ECMAScript"],
  Python: ["Python"],
  Java: ["Java"],
  "C#": ["C#", "C Sharp", "CSharp"],
  "C++": ["C\\+\\+", "CPP"],
  Go: ["Golang", "Go lang"],
  Rust: ["Rust"],
  Ruby: ["Ruby"],
  PHP: ["PHP"],
  Swift: ["Swift"],
  Kotlin: ["Kotlin"],
  Flutter: ["Flutter"],
  "React Native": ["React Native"],
  Dart: ["Dart"],
  AWS: ["AWS", "Amazon Web Services"],
  Azure: ["Azure", "Microsoft Azure"],
  GCP: ["GCP", "Google Cloud"],
  Docker: ["Docker"],
  Kubernetes: ["Kubernetes", "K8s"],
  Terraform: ["Terraform"],
  PostgreSQL: ["PostgreSQL", "Postgres"],
  MySQL: ["MySQL"],
  MongoDB: ["MongoDB", "Mongo"],
  Redis: ["Redis"],
  Elasticsearch: ["Elasticsearch", "Elastic Search"],
  GraphQL: ["GraphQL"],
  REST: ["REST", "RESTful"],
  Microservices: ["Microservices", "Micro-services"],
  "CI/CD": ["CI/CD", "CI CD", "CICD"],
  Git: ["Git"],
  Tailwind: ["Tailwind", "TailwindCSS"],
  Sass: ["Sass", "SCSS"],
  HTML: ["HTML", "HTML5"],
  CSS: ["CSS", "CSS3"],
  Figma: ["Figma"],
  "Machine Learning": ["Machine Learning", "ML"],
  "Deep Learning": ["Deep Learning", "DL"],
  NLP: ["NLP", "Natural Language Processing"],
  TensorFlow: ["TensorFlow"],
  PyTorch: ["PyTorch"],
  Django: ["Django"],
  Flask: ["Flask"],
  FastAPI: ["FastAPI"],
  Spring: ["Spring", "Spring Boot"],
  Laravel: ["Laravel"],
  ".NET": [".NET", "ASP.NET", "DotNet"],
  SQL: ["SQL"],
  Linux: ["Linux", "Ubuntu", "CentOS"],
  Nginx: ["Nginx"],
  Jenkins: ["Jenkins"],
  Ansible: ["Ansible"],
  Kafka: ["Kafka"],
  RabbitMQ: ["RabbitMQ"],
  Prisma: ["Prisma"],
  Firebase: ["Firebase"],
  Supabase: ["Supabase"],
  Vercel: ["Vercel"],
  Netlify: ["Netlify"],
  Svelte: ["Svelte", "SvelteKit"],
  Remix: ["Remix"],
  Astro: ["Astro"],
  Playwright: ["Playwright"],
  Cypress: ["Cypress"],
  Jest: ["Jest"],
  Selenium: ["Selenium"],
  Pandas: ["Pandas"],
  NumPy: ["NumPy"],
  Scikit: ["Scikit-learn", "Scikit"],
  R: ["R language"],
  Tableau: ["Tableau"],
  "Power BI": ["Power BI", "PowerBI"],
  Hadoop: ["Hadoop"],
  Spark: ["Spark", "Apache Spark"],
  Airflow: ["Airflow"],
  Solidity: ["Solidity"],
  Web3: ["Web3"],
  Unity: ["Unity"],
  Unreal: ["Unreal Engine", "Unreal"],
  "Three.js": ["Three.js", "ThreeJS"],
  OpenAI: ["OpenAI"],
  LangChain: ["LangChain"],
  Shopify: ["Shopify"],
  WordPress: ["WordPress"],
  Salesforce: ["Salesforce"],
  SAP: ["SAP"],
};

export function extractSkillsFromContent(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];

  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    for (const alias of aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      if (regex.test(text)) {
        found.push(canonical);
        break;
      }
    }
  }

  return found;
}
