export const KEYWORD_PRESETS: { group: string; keywords: string[] }[] = [
  {
    group: "Architecture & Design",
    keywords: [
      "Code structure", "Modular routing", "Data flow design",
      "ERD modelling", "Folder conventions", "Request/response pipelines",
    ],
  },
  {
    group: "Backend Stack",
    keywords: [
      "Node.js", "Express.js", "MongoDB", "React.js",
      "Mongoose", "CRUD pipelines",
    ],
  },
  {
    group: "JavaScript (ES6+)",
    keywords: [
      "JavaScript", "ES6+", "Async/await",
      "Closures", "Promises", "Event-driven patterns",
    ],
  },
  {
    group: "TypeScript",
    keywords: [
      "TypeScript", "Typed interfaces", "DTOs",
      "NestJS modules", "Class-based services",
    ],
  },
  {
    group: "Frontend",
    keywords: [
      "React", "React hooks", "Responsive layouts",
      "Tailwind CSS", "Next.js", "HTML/CSS",
    ],
  },
  {
    group: "Backend",
    keywords: [
      "Node.js", "Express.js", "NestJS",
      "JWT auth", "Middleware", "Validation",
      "REST APIs", "GraphQL",
    ],
  },
  {
    group: "DevOps & Cloud",
    keywords: [
      "Docker", "Kubernetes", "CI/CD",
      "AWS", "Azure", "GCP", "Terraform",
    ],
  },
  {
    group: "Data & AI",
    keywords: [
      "Python", "Machine Learning", "Data Science",
      "Pandas", "TensorFlow", "PyTorch", "SQL",
    ],
  },
  {
    group: "Mobile",
    keywords: [
      "React Native", "Flutter", "Swift",
      "Kotlin", "iOS", "Android",
    ],
  },
  {
    group: "Database",
    keywords: [
      "PostgreSQL", "MySQL", "MongoDB",
      "Redis", "Prisma", "Sequelize",
    ],
  },
];

export const JOB_CATEGORIES = [
  "Frontend Development",
  "Backend Development",
  "Full Stack Development",
  "Mobile Development (iOS)",
  "Mobile Development (Android)",
  "Mobile Development (Cross-Platform)",
  "DevOps / SRE",
  "Cloud Engineering",
  "Data Engineering",
  "Data Science",
  "Machine Learning / AI",
  "NLP / LLM Engineering",
  "Computer Vision",
  "Cybersecurity",
  "Blockchain / Web3",
  "Game Development",
  "Embedded Systems / IoT",
  "QA / Testing / Automation",
  "Technical Writing",
  "Developer Relations / Advocacy",
  "Product Management (Technical)",
  "Engineering Management",
  "UI/UX Design",
  "Database Administration",
  "Network Engineering",
  "Systems Programming",
  "Compiler / Language Design",
  "AR / VR Development",
  "Robotics Engineering",
  "Bioinformatics",
  "Fintech / Quantitative Engineering",
  "E-commerce Development",
  "CMS / WordPress Development",
  "ERP / SAP Development",
  "Accessibility Engineering",
] as const;

export const TONE_OPTIONS = [
  { value: "professional", label: "Professional", description: "Polished and formal" },
  { value: "friendly", label: "Friendly", description: "Warm and approachable" },
  { value: "confident", label: "Confident", description: "Bold and direct" },
  { value: "casual", label: "Casual", description: "Relaxed and conversational" },
  { value: "formal", label: "Formal", description: "Traditional and structured" },
] as const;

export const LANGUAGE_OPTIONS = [
  "English", "German", "Urdu", "Hindi", "Arabic", "French", "Spanish",
  "Chinese", "Japanese", "Korean", "Turkish", "Portuguese", "Russian", "Italian", "Dutch",
] as const;

export const JOB_SOURCES = [
  { value: "jsearch", label: "JSearch", needsKey: true, limit: "200/month" },
  { value: "indeed", label: "Indeed", needsKey: false, limit: "Unlimited" },
  { value: "remotive", label: "Remotive", needsKey: false, limit: "Unlimited" },
  { value: "arbeitnow", label: "Arbeitnow", needsKey: false, limit: "Unlimited" },
  { value: "adzuna", label: "Adzuna", needsKey: true, limit: "200/day" },
  { value: "linkedin", label: "LinkedIn", needsKey: false, limit: "Unlimited" },
  { value: "rozee", label: "Rozee.pk", needsKey: false, limit: "Unlimited" },
  { value: "google", label: "Google Jobs", needsKey: true, limit: "100/month" },
] as const;

export const EXPERIENCE_LEVELS = [
  { value: "entry", label: "Entry Level (0-2 years)" },
  { value: "mid", label: "Mid Level (2-5 years)" },
  { value: "senior", label: "Senior (5-8 years)" },
  { value: "lead", label: "Lead (8+ years)" },
  { value: "executive", label: "Executive" },
] as const;

export const EDUCATION_LEVELS = [
  { value: "high-school", label: "High School" },
  { value: "bachelors", label: "Bachelor's Degree" },
  { value: "masters", label: "Master's Degree" },
  { value: "phd", label: "PhD" },
] as const;

export const WORK_TYPES = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
] as const;

export const JOB_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "freelance", label: "Freelance" },
  { value: "internship", label: "Internship" },
] as const;

export const SALARY_CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "PKR", label: "PKR (₨)" },
  { value: "INR", label: "INR (₹)" },
  { value: "AED", label: "AED (د.إ)" },
  { value: "CAD", label: "CAD ($)" },
  { value: "AUD", label: "AUD ($)" },
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];
export type ToneOption = (typeof TONE_OPTIONS)[number]["value"];
export type LanguageOption = (typeof LANGUAGE_OPTIONS)[number];
export type JobSource = (typeof JOB_SOURCES)[number]["value"];
