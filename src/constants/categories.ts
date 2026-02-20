export const KEYWORD_PRESETS: { group: string; keywords: string[] }[] = [
  {
    group: "Python Stack",
    keywords: [
      "Python", "Django", "Flask", "FastAPI",
      "Celery", "SQLAlchemy", "Pydantic", "Poetry",
      "Pytest", "Gunicorn", "Uvicorn",
    ],
  },
  {
    group: "JavaScript Stack",
    keywords: [
      "JavaScript", "Node.js", "Express.js", "React",
      "Vue.js", "Angular", "jQuery", "Webpack",
      "Vite", "Babel", "ESLint", "Jest",
    ],
  },
  {
    group: "TypeScript Stack",
    keywords: [
      "TypeScript", "Next.js", "NestJS", "Prisma",
      "tRPC", "Zod", "SWR", "React Query",
      "Drizzle", "Type-safe APIs",
    ],
  },
  {
    group: "Java Stack",
    keywords: [
      "Java", "Spring Boot", "Spring", "Hibernate",
      "Maven", "Gradle", "JPA", "Microservices",
      "Kafka", "JUnit", "Tomcat",
    ],
  },
  {
    group: "C# / .NET Stack",
    keywords: [
      "C#", ".NET", "ASP.NET", "Entity Framework",
      "Blazor", "Azure Functions", "LINQ",
      "NuGet", "xUnit", "SignalR",
    ],
  },
  {
    group: "PHP Stack",
    keywords: [
      "PHP", "Laravel", "Symfony", "WordPress",
      "Composer", "Livewire", "Blade",
      "PHPUnit", "Eloquent",
    ],
  },
  {
    group: "Go Stack",
    keywords: [
      "Go", "Golang", "Gin", "Echo",
      "gRPC", "Protocol Buffers", "Goroutines",
      "Go modules",
    ],
  },
  {
    group: "Ruby Stack",
    keywords: [
      "Ruby", "Ruby on Rails", "Rails",
      "Sidekiq", "RSpec", "ActiveRecord",
      "Sinatra", "Hotwire",
    ],
  },
  {
    group: "Frontend & UI",
    keywords: [
      "React", "Vue.js", "Angular", "Svelte",
      "Tailwind CSS", "CSS", "HTML", "Sass",
      "Figma", "Storybook", "Responsive Design",
    ],
  },
  {
    group: "Mobile Development",
    keywords: [
      "React Native", "Flutter", "Swift", "SwiftUI",
      "Kotlin", "iOS", "Android", "Expo",
      "Dart", "Xcode", "Android Studio",
    ],
  },
  {
    group: "DevOps & Cloud",
    keywords: [
      "Docker", "Kubernetes", "AWS", "Azure",
      "GCP", "Terraform", "CI/CD", "GitHub Actions",
      "Jenkins", "Ansible", "Linux", "Nginx",
    ],
  },
  {
    group: "Data & AI / ML",
    keywords: [
      "Python", "Machine Learning", "Deep Learning",
      "TensorFlow", "PyTorch", "Pandas", "NumPy",
      "Scikit-learn", "NLP", "LLM", "Data Science",
      "Jupyter", "Spark", "Airflow",
    ],
  },
  {
    group: "Databases",
    keywords: [
      "PostgreSQL", "MySQL", "MongoDB", "Redis",
      "Elasticsearch", "DynamoDB", "Supabase",
      "Prisma", "Sequelize", "SQL", "NoSQL",
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
