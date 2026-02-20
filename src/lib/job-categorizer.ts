const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Frontend Development": [
    "frontend", "front-end", "front end", "react developer", "vue developer",
    "angular developer", "ui developer", "ui engineer", "react", "vue", "angular",
    "next.js", "nuxt", "svelte", "tailwind", "css", "html", "javascript developer",
    "typescript developer",
  ],
  "Backend Development": [
    "backend", "back-end", "back end", "server-side", "api developer",
    "microservices engineer", "node.js", "express", "django", "flask", "fastapi",
    "spring boot", "laravel", "ruby on rails", "golang developer",
  ],
  "Full Stack Development": [
    "full stack", "fullstack", "full-stack", "mern", "mean stack", "lamp",
  ],
  "DevOps / SRE": [
    "devops", "dev ops", "sre", "site reliability", "infrastructure engineer",
    "ci/cd", "platform engineer", "kubernetes", "docker", "terraform",
  ],
  "Machine Learning / AI": [
    "machine learning", "ml engineer", "ai engineer", "deep learning",
    "nlp engineer", "computer vision", "llm", "generative ai",
  ],
  "Data Science": [
    "data scientist", "data science", "data analyst", "analytics engineer",
    "statistical", "business analyst",
  ],
  "Data Engineering": [
    "data engineer", "etl", "data pipeline", "airflow", "spark engineer",
    "big data", "dbt", "snowflake", "bigquery",
  ],
  "Mobile Development (iOS)": ["ios developer", "ios engineer", "swift developer"],
  "Mobile Development (Android)": ["android developer", "android engineer", "kotlin developer"],
  "Mobile Development (Cross-Platform)": [
    "react native", "flutter", "mobile developer", "mobile engineer", "cross-platform",
  ],
  Cybersecurity: [
    "security engineer", "cybersecurity", "penetration", "infosec",
    "security analyst", "soc analyst",
  ],
  "Cloud Engineering": [
    "cloud engineer", "cloud architect", "aws engineer", "azure engineer",
    "gcp engineer", "cloud",
  ],
  "QA / Testing": [
    "qa engineer", "test engineer", "quality assurance", "sdet",
    "automation tester", "test automation", "selenium", "cypress",
  ],
  "Blockchain / Web3": [
    "blockchain", "web3", "smart contract", "solidity", "ethereum", "crypto",
  ],
  "Game Development": [
    "game developer", "game engineer", "unity developer", "unreal", "game programmer",
  ],
  "Embedded / IoT": [
    "embedded", "firmware", "iot engineer", "hardware engineer", "microcontroller",
  ],
  "Database Administration": ["dba", "database admin", "database engineer", "sql developer"],
  "UI/UX Design": [
    "ui/ux", "ux designer", "ui designer", "product designer", "interaction design",
    "figma", "sketch",
  ],
  "Product Management": ["product manager", "product owner", "program manager"],
  "Technical Writing": ["technical writer", "documentation", "content developer"],
  "System Administration": [
    "system admin", "sysadmin", "systems engineer", "it administrator",
  ],
  "Network Engineering": ["network engineer", "network admin", "cisco", "routing"],
  "ERP / SAP": ["sap consultant", "erp", "sap developer", "oracle erp"],
  Salesforce: ["salesforce", "sfdc", "apex developer"],
  "WordPress / CMS": ["wordpress", "drupal", "cms developer"],
  "E-Commerce": ["shopify", "magento", "woocommerce", "e-commerce developer"],
  "AR / VR": ["augmented reality", "virtual reality", "ar/vr", "mixed reality"],
  Robotics: ["robotics", "ros", "robot engineer"],
  "Compiler / Language": ["compiler", "language design", "llvm", "interpreter"],
  "Site Reliability": ["site reliability", "sre", "reliability engineer"],
  "Solutions Architect": [
    "solutions architect", "technical architect", "enterprise architect",
  ],
  "IT Support": ["it support", "help desk", "technical support", "desktop support"],
  "Project Management": ["project manager", "scrum master", "agile coach"],
  "Business Intelligence": [
    "business intelligence", "bi developer", "bi analyst", "tableau", "power bi",
  ],
  "Software Engineering": [
    "software engineer", "software developer", "programmer", "developer",
  ],
  // Non-tech categories (for hard-filter to correctly reject for tech users)
  Sales: ["sales", "account executive", "business development", "sdr", "bdr", "inside sales"],
  Marketing: ["marketing", "seo", "social media", "growth", "digital marketing"],
  HR: ["hr", "human resources", "recruiter", "talent acquisition", "people operations"],
  Finance: ["finance", "accounting", "bookkeeping", "financial analyst", "cfo"],
  "Customer Support": ["customer support", "customer success", "help desk", "support agent"],
  Writing: ["copywriter", "content writer", "editor", "freelance writer", "blogger"],
  Management: ["manager", "director", "vp", "head of", "chief"],
  Legal: ["lawyer", "legal counsel", "paralegal", "compliance"],
  Operations: ["operations", "logistics", "supply chain", "warehouse"],
  Education: ["teacher", "tutor", "instructor", "professor", "training"],
};

export function categorizeJob(title: string, skills: string[], description: string): string {
  const text = `${title} ${skills.join(" ")} ${description.substring(0, 800)}`.toLowerCase();

  let bestCategory = "Software Engineering";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) score++;
    }
    // Give extra weight if keyword appears in the title
    const titleLower = title.toLowerCase();
    for (const kw of keywords) {
      if (titleLower.includes(kw)) score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}
