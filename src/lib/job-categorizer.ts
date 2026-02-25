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
  "Cybersecurity": [
    "security engineer", "cybersecurity", "penetration", "infosec",
    "security analyst", "soc analyst",
  ],
  "Cloud Engineering": [
    "cloud engineer", "cloud architect", "aws engineer", "azure engineer",
    "gcp engineer", "cloud",
  ],
  "QA / Testing / Automation": [
    "qa engineer", "test engineer", "quality assurance", "sdet",
    "automation tester", "test automation", "selenium", "cypress",
  ],
  "Blockchain / Web3": [
    "blockchain", "web3", "smart contract", "solidity", "ethereum", "crypto",
  ],
  "Game Development": [
    "game developer", "game engineer", "unity developer", "unreal", "game programmer",
  ],
  "Embedded Systems / IoT": [
    "embedded", "firmware", "iot engineer", "hardware engineer", "microcontroller",
  ],
  "Database Administration": ["dba", "database admin", "database engineer", "sql developer"],
  "UI/UX Design": [
    "ui/ux", "ux designer", "ui designer", "product designer", "interaction design",
    "figma", "sketch",
  ],
  "Product Management (Technical)": ["product manager", "product owner", "program manager", "technical pm"],
  "Technical Writing": [
    "technical writer", "documentation", "content developer",
    "api documentation", "developer docs",
  ],
  "System Administration": [
    "system admin", "sysadmin", "systems engineer", "it administrator",
  ],
  "Network Engineering": ["network engineer", "network admin", "cisco", "routing"],
  "ERP / SAP Development": ["sap consultant", "erp", "sap developer", "oracle erp"],
  Salesforce: ["salesforce", "sfdc", "apex developer"],
  "CMS / WordPress Development": ["wordpress", "drupal", "cms developer"],
  "E-commerce Development": ["shopify", "magento", "woocommerce", "e-commerce developer"],
  "AR / VR Development": ["augmented reality", "virtual reality", "ar/vr", "mixed reality"],
  "Robotics Engineering": ["robotics", "ros", "robot engineer"],
  "Compiler / Language Design": ["compiler", "language design", "llvm", "interpreter"],
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
  // Content & Creative (match JOB_CATEGORIES)
  "Content Writing": [
    "content writer", "content writing", "content creator", "blogger",
    "freelance writer", "editor", "editorial", "article writer",
    "blog writing", "creative writing", "proofreader", "content strategist",
  ],
  Copywriting: [
    "copywriter", "copywriting", "copy writer", "creative copy",
    "ad copy", "marketing copy", "brand copy",
  ],
  // Marketing & Sales (match JOB_CATEGORIES)
  Marketing: ["marketing", "brand", "growth", "demand gen", "brand manager"],
  "Digital Marketing": [
    "digital marketing", "social media", "ppc", "paid social",
    "performance marketing", "marketing automation", "affiliate",
    "influencer", "community manager", "email marketing",
  ],
  "SEO / Content Marketing": [
    "seo", "search engine", "content marketing", "organic growth",
    "seo writer", "seo content",
  ],
  Sales: ["sales rep", "sales representative", "inside sales", "sales manager", "closing"],
  "Business Development": [
    "business development", "bdr", "sdr", "account executive",
    "sales development", "bidders", "bidding", "proposal",
    "tender", "rfp", "rfq", "proposal writer", "bid writer",
  ],
  "Account Executive / SDR": [
    "account executive", "ae", "sdr", "bdr", "closing",
  ],
  // Business & Operations (match JOB_CATEGORIES)
  "HR / Talent Acquisition": [
    "hr", "human resources", "recruiter", "talent acquisition",
    "people operations", "hiring",
  ],
  "Finance / Accounting": [
    "finance", "accounting", "bookkeeping", "financial analyst",
    "cfo", "controller", "accountant",
  ],
  "Customer Support": [
    "customer support", "customer success", "help desk", "support agent",
    "customer service",
  ],
  Operations: ["operations", "logistics", "supply chain", "warehouse", "ops"],
  Legal: ["lawyer", "legal counsel", "paralegal", "compliance"],
  "Education / Training": [
    "teacher", "tutor", "instructor", "professor", "training",
    "educational",
  ],
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
