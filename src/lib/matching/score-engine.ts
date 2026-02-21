/**
 * Computes a 0-100 match score between a GlobalJob and a user's settings/resumes.
 * Uses HARD FILTERS first (keyword, platform, category, location) to reject irrelevant jobs,
 * then scores remaining jobs on 7 weighted factors.
 */

export const MATCH_THRESHOLDS = {
  SHOW_ON_KANBAN: 40,
  NOTIFY: 50,
  AUTO_DRAFT: 55,
  AUTO_SEND: 65,
} as const;

interface GlobalJobLike {
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  salary: string | null;
  jobType: string | null;
  experienceLevel: string | null;
  category: string | null;
  skills: string[];
  source?: string;
  isFresh?: boolean;
  firstSeenAt?: Date | null;
}

interface UserSettingsLike {
  keywords: string[];
  city: string | null;
  country: string | null;
  experienceLevel: string | null;
  workType: string[];
  jobType: string[];
  preferredCategories: string[];
  preferredPlatforms: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  blacklistedCompanies?: string[];
}

interface ResumeLike {
  content: string | null;
  name: string;
}

interface MatchResult {
  score: number;
  reasons: string[];
  bestResumeId: string | null;
  bestResumeName: string | null;
}

const REJECT: MatchResult = { score: 0, reasons: [], bestResumeId: null, bestResumeName: null };

// Words too generic to use for fuzzy category matching
const CATEGORY_STOP_WORDS = new Set([
  "development", "engineering", "management", "design", "systems",
  "science", "writing", "relations", "administration", "programming",
  "testing", "automation", "advocacy", "mobile", "cloud", "data",
  "network", "product", "technical", "cross", "platform", "web",
  "general", "other", "misc", "specialist", "senior", "junior",
  "lead", "head", "chief", "manager", "director", "officer",
]);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalizes unicode oddities that scrapers/LinkedIn introduce:
 *  - All dash variants (en-dash, em-dash, non-breaking hyphen …) → ASCII hyphen
 *  - All whitespace variants (NBSP, em-space …) → regular space
 *  - Smart quotes → ASCII quotes
 *  - HTML entities that slipped past the sanitizer
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/[\u2018\u2019\u201A\uFF07]/g, "'")
    .replace(/[\u201C\u201D\u201E\uFF02]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .trim();
}

// Complete technology variants map — covers languages, frameworks, databases, cloud, DevOps, etc.
const COMPOUND_VARIANTS: Record<string, string[]> = {
  // ── ROLE / POSITION VARIANTS ──
  "full stack":     ["fullstack", "full-stack", "full stack", "full_stack"],
  "front end":      ["frontend", "front-end", "front end", "front_end"],
  "back end":       ["backend", "back-end", "back end", "back_end"],
  "dev ops":        ["devops", "dev-ops", "dev ops", "dev_ops"],
  "site reliability": ["sre", "site reliability", "site-reliability"],
  "machine learning": ["ml", "machine learning", "machine-learning"],
  "artificial intelligence": ["ai", "artificial intelligence", "artificial-intelligence"],
  "data science":   ["data science", "data-science", "datascience"],
  "data engineer":  ["data engineer", "data-engineer", "data engineering"],
  "quality assurance": ["qa", "quality assurance", "quality-assurance"],
  "ui/ux":          ["ui/ux", "uiux", "ui ux", "ux/ui", "ux ui"],
  "tech lead":      ["tech lead", "tech-lead", "technical lead", "engineering lead"],
  "software engineer": ["swe", "software engineer", "software-engineer", "software developer"],
  "web developer":  ["web developer", "web-developer", "web dev", "webdev"],
  // ── JAVASCRIPT ECOSYSTEM ──
  "node.js":        ["node.js", "nodejs", "node js", "node"],
  "next.js":        ["next.js", "nextjs", "next js"],
  "react":          ["react", "react.js", "reactjs"],
  "react native":   ["react native", "react-native", "reactnative"],
  "vue.js":         ["vue.js", "vuejs", "vue js", "vue"],
  "nuxt.js":        ["nuxt.js", "nuxtjs", "nuxt js", "nuxt"],
  "angular":        ["angular", "angularjs", "angular.js"],
  "svelte":         ["svelte", "sveltejs", "sveltekit", "svelte kit"],
  "express":        ["express", "express.js", "expressjs"],
  "nestjs":         ["nestjs", "nest.js", "nest js", "nest"],
  "gatsby":         ["gatsby", "gatsby.js", "gatsbyjs"],
  "remix":          ["remix", "remix.run", "remixjs"],
  "astro":          ["astro", "astro.js", "astrojs"],
  "deno":           ["deno", "deno.js", "denojs"],
  "bun":            ["bun", "bun.js", "bunjs"],
  "electron":       ["electron", "electron.js", "electronjs"],
  "three.js":       ["three.js", "threejs", "three js"],
  "d3.js":          ["d3.js", "d3js", "d3 js", "d3"],
  "jquery":         ["jquery", "jquery.js"],
  "typescript":     ["typescript", "type script"],
  "javascript":     ["javascript", "java script", "ecmascript", "es6"],
  // ── PYTHON ECOSYSTEM ──
  "python":         ["python", "python3", "python 3"],
  "django":         ["django", "django rest", "drf", "django rest framework"],
  "flask":          ["flask", "flask api", "flask-api"],
  "fastapi":        ["fastapi", "fast api", "fast-api"],
  "pytorch":        ["pytorch", "py torch", "torch"],
  "tensorflow":     ["tensorflow", "tensor flow", "tensor-flow"],
  "scikit-learn":   ["scikit-learn", "sklearn", "scikit learn"],
  "pandas":         ["pandas"],
  "numpy":          ["numpy"],
  "playwright":     ["playwright", "playwright test"],
  "selenium":       ["selenium", "selenium webdriver"],
  "jupyter":        ["jupyter", "jupyter notebook", "jupyterlab"],
  "streamlit":      ["streamlit", "streamlit app"],
  "pydantic":       ["pydantic"],
  // ── JAVA ECOSYSTEM ──
  "java":           ["java", "java se", "java ee", "jdk"],
  "spring":         ["spring", "spring framework"],
  "spring boot":    ["spring boot", "spring-boot", "springboot"],
  "hibernate":      ["hibernate", "hibernate orm"],
  "maven":          ["maven", "apache maven", "mvn"],
  "gradle":         ["gradle", "gradle build"],
  "kafka":          ["kafka", "apache kafka", "kafka streams"],
  "kotlin":         ["kotlin", "kotlinx"],
  // ── C# / .NET ECOSYSTEM ──
  "c#":             ["c#", "csharp", "c sharp", "c-sharp"],
  ".net":           [".net", "dotnet", "dot net", ".net core", "dotnet core"],
  "asp.net":        ["asp.net", "aspnet", "asp net", "asp.net core"],
  "blazor":         ["blazor", "blazor server", "blazor wasm"],
  "entity framework": ["entity framework", "ef", "ef core", "efcore"],
  // ── PHP ECOSYSTEM ──
  "php":            ["php", "php8", "php 8"],
  "laravel":        ["laravel", "laravel framework"],
  "symfony":        ["symfony"],
  "wordpress":      ["wordpress", "word press", "wp"],
  "drupal":         ["drupal", "drupal cms"],
  "codeigniter":    ["codeigniter", "code igniter", "ci4"],
  // ── RUBY ECOSYSTEM ──
  "ruby":           ["ruby"],
  "ruby on rails":  ["ruby on rails", "rails", "ror", "ruby-on-rails"],
  // ── GO ECOSYSTEM ──
  "golang":         ["golang", "go lang", "go"],
  "gin":            ["gin", "gin-gonic", "gin gonic"],
  // ── RUST ECOSYSTEM ──
  "rust":           ["rust", "rust lang", "rustlang"],
  "actix":          ["actix", "actix-web", "actix web"],
  "tokio":          ["tokio"],
  // ── SWIFT / iOS ECOSYSTEM ──
  "swift":          ["swift", "swiftui", "swift ui"],
  "ios":            ["ios", "ios dev", "ios development"],
  "objective-c":    ["objective-c", "objc", "obj-c", "objective c"],
  // ── ANDROID / MOBILE ──
  "android":        ["android", "android dev"],
  "flutter":        ["flutter", "flutter dev", "flutter dart"],
  "dart":           ["dart", "dart lang"],
  "expo":           ["expo", "expo react native"],
  "ionic":          ["ionic", "ionic framework"],
  // ── DATABASES ──
  "postgresql":     ["postgresql", "postgres", "psql", "pg"],
  "mysql":          ["mysql", "my sql", "mariadb"],
  "mongodb":        ["mongodb", "mongo", "mongo db", "mongoose"],
  "redis":          ["redis", "redis cache"],
  "elasticsearch":  ["elasticsearch", "elastic search", "elk"],
  "dynamodb":       ["dynamodb", "dynamo db"],
  "firebase":       ["firebase", "firestore", "firebase realtime"],
  "supabase":       ["supabase"],
  "sqlite":         ["sqlite", "sqlite3"],
  "neo4j":          ["neo4j"],
  "oracle":         ["oracle", "oracle db", "oracledb", "plsql", "pl/sql"],
  "sql server":     ["sql server", "mssql", "ms sql", "microsoft sql", "tsql", "t-sql"],
  "prisma":         ["prisma", "prisma orm"],
  "drizzle":        ["drizzle", "drizzle orm"],
  "typeorm":        ["typeorm", "type orm"],
  "sequelize":      ["sequelize"],
  "knex":           ["knex", "knex.js", "knexjs"],
  // ── CLOUD PLATFORMS ──
  "aws":            ["aws", "amazon web services"],
  "azure":          ["azure", "microsoft azure"],
  "gcp":            ["gcp", "google cloud", "google cloud platform"],
  "digital ocean":  ["digital ocean", "digitalocean"],
  "heroku":         ["heroku"],
  "vercel":         ["vercel"],
  "netlify":        ["netlify"],
  "cloudflare":     ["cloudflare", "cloudflare workers", "cloudflare pages"],
  "railway":        ["railway"],
  "fly.io":         ["fly.io", "flyio", "fly io"],
  // ── AWS SERVICES ──
  "ec2":            ["ec2", "aws ec2"],
  "s3":             ["s3", "aws s3"],
  "lambda":         ["lambda", "aws lambda", "serverless lambda"],
  "ecs":            ["ecs", "aws ecs"],
  "eks":            ["eks", "aws eks"],
  "rds":            ["rds", "aws rds"],
  // ── DEVOPS & TOOLS ──
  "docker":         ["docker", "docker-compose", "docker compose", "dockerfile"],
  "kubernetes":     ["kubernetes", "k8s", "kube"],
  "terraform":      ["terraform", "hashicorp terraform"],
  "ansible":        ["ansible", "ansible playbook"],
  "jenkins":        ["jenkins", "jenkins ci"],
  "github actions": ["github actions", "github-actions", "gh actions"],
  "gitlab ci":      ["gitlab ci", "gitlab-ci", "gitlab ci/cd"],
  "ci/cd":          ["ci/cd", "cicd", "ci cd", "ci-cd", "continuous integration"],
  "nginx":          ["nginx", "reverse proxy nginx"],
  "linux":          ["linux", "ubuntu", "debian", "centos", "redhat", "rhel"],
  "bash":           ["bash", "bash script", "shell script", "shell"],
  "git":            ["git", "gitflow", "git-flow"],
  "github":         ["github"],
  "gitlab":         ["gitlab"],
  "prometheus":     ["prometheus", "prometheus monitoring"],
  "grafana":        ["grafana", "grafana dashboard"],
  "datadog":        ["datadog", "data dog"],
  "helm":           ["helm", "helm charts"],
  "argo cd":        ["argo cd", "argocd", "argo-cd"],
  // ── TESTING ──
  "jest":           ["jest", "jestjs"],
  "mocha":          ["mocha", "mochajs"],
  "cypress":        ["cypress", "cypress.io"],
  "pytest":         ["pytest", "py test"],
  "vitest":         ["vitest"],
  "testing library": ["testing library", "testing-library", "react testing library"],
  "storybook":      ["storybook", "storybookjs"],
  "puppeteer":      ["puppeteer"],
  "postman":        ["postman", "postman api"],
  // ── CSS / STYLING ──
  "tailwind":       ["tailwind", "tailwindcss", "tailwind css", "tailwind-css"],
  "css":            ["css", "css3"],
  "sass":           ["sass", "scss"],
  "less":           ["less", "less css"],
  "styled components": ["styled components", "styled-components"],
  "bootstrap":      ["bootstrap", "bootstrap 5", "bootstrap5"],
  "material ui":    ["material ui", "material-ui", "materialui", "mui"],
  "chakra ui":      ["chakra ui", "chakra-ui", "chakraui"],
  "ant design":     ["ant design", "antd", "ant-design"],
  "shadcn":         ["shadcn", "shadcn ui", "shadcn-ui", "shadcn/ui"],
  "radix":          ["radix", "radix ui", "radix-ui"],
  "framer motion":  ["framer motion", "framer-motion"],
  // ── HTML ──
  "html":           ["html", "html5"],
  // ── STATE MANAGEMENT ──
  "redux":          ["redux", "redux toolkit", "redux-toolkit", "rtk"],
  "zustand":        ["zustand"],
  "mobx":           ["mobx"],
  "recoil":         ["recoil"],
  "pinia":          ["pinia"],
  // ── API / COMMUNICATION ──
  "rest api":       ["rest api", "rest-api", "restapi", "restful", "restful api"],
  "graphql":        ["graphql", "graph ql", "gql"],
  "grpc":           ["grpc", "g rpc"],
  "websocket":      ["websocket", "web socket", "socket.io", "socketio"],
  "trpc":           ["trpc"],
  "swagger":        ["swagger", "openapi", "open api"],
  // ── MESSAGE QUEUES ──
  "rabbitmq":       ["rabbitmq", "rabbit mq", "amqp"],
  "bullmq":         ["bullmq", "bull mq", "bull"],
  // ── AI / ML ──
  "openai":         ["openai", "open ai", "chatgpt", "gpt"],
  "langchain":      ["langchain", "lang chain"],
  "hugging face":   ["hugging face", "huggingface"],
  "llm":            ["llm", "large language model"],
  "rag":            ["rag", "retrieval augmented generation"],
  "computer vision": ["computer vision", "cv", "computer-vision"],
  "nlp":            ["nlp", "natural language processing"],
  "deep learning":  ["deep learning", "deep-learning", "deeplearning"],
  "opencv":         ["opencv", "open cv"],
  // ── BLOCKCHAIN / WEB3 ──
  "web3":           ["web3", "web 3", "web3.0"],
  "solidity":       ["solidity"],
  "ethereum":       ["ethereum", "eth", "evm"],
  "hardhat":        ["hardhat"],
  // ── AUTH & SECURITY ──
  "oauth":          ["oauth", "oauth2", "oauth 2", "oauth2.0"],
  "jwt":            ["jwt", "json web token", "jsonwebtoken"],
  "auth0":          ["auth0"],
  "nextauth":       ["nextauth", "next auth", "next-auth", "authjs", "auth.js"],
  "passport":       ["passport", "passport.js", "passportjs"],
  // ── CMS ──
  "strapi":         ["strapi"],
  "sanity":         ["sanity", "sanity.io", "sanity cms"],
  "contentful":     ["contentful"],
  "payload":        ["payload", "payload cms"],
  // ── DESIGN TOOLS ──
  "figma":          ["figma"],
  // ── METHODOLOGIES ──
  "agile":          ["agile", "agile methodology"],
  "scrum":          ["scrum", "scrum master"],
  "tdd":            ["tdd", "test driven development"],
  "microservices":  ["microservices", "micro services", "micro-services"],
  "monorepo":       ["monorepo", "mono repo"],
  "serverless":     ["serverless", "faas"],
  "event driven":   ["event driven", "event-driven", "eventdriven"],
  // ── DATA / BI ──
  "tableau":        ["tableau"],
  "power bi":       ["power bi", "powerbi", "power-bi"],
  "apache spark":   ["apache spark", "spark", "pyspark"],
  "hadoop":         ["hadoop", "apache hadoop"],
  "airflow":        ["airflow", "apache airflow"],
  "dbt":            ["dbt", "data build tool"],
  "snowflake":      ["snowflake", "snowflake db"],
  "bigquery":       ["bigquery", "big query", "google bigquery"],
  "redshift":       ["redshift", "amazon redshift"],
  "etl":            ["etl", "extract transform load", "elt"],
  // ── OTHER LANGUAGES ──
  "scala":          ["scala"],
  "elixir":         ["elixir", "phoenix"],
  "haskell":        ["haskell"],
  "r":              ["r language", "r programming", "rlang", "rstudio"],
  "matlab":         ["matlab"],
  "perl":           ["perl"],
  "lua":            ["lua", "luajit"],
  "clojure":        ["clojure", "clojurescript"],
  "erlang":         ["erlang", "erlang otp"],
  "c++":            ["c++", "cpp", "c plus plus"],
  "embedded":       ["embedded", "embedded systems"],
  "iot":            ["iot", "internet of things"],
  // ── SAP / ERP ──
  "sap":            ["sap", "sap erp", "sap hana", "sap abap"],
  "salesforce":     ["salesforce", "sfdc", "apex", "visualforce"],
  // ── GAME DEV ──
  "unity":          ["unity", "unity3d", "unity 3d"],
  "unreal engine":  ["unreal engine", "unreal", "ue5", "ue4"],
  "godot":          ["godot", "godot engine"],
};

function getKeywordVariants(keyword: string): string[] {
  const kw = keyword.toLowerCase().trim();
  for (const [canonical, variants] of Object.entries(COMPOUND_VARIANTS)) {
    if (kw === canonical || variants.includes(kw)) {
      return Array.from(new Set([kw, canonical, ...variants]));
    }
  }
  return [kw];
}

/**
 * Checks if a keyword appears as a whole word/phrase in text.
 * Prevents "css" from matching "accessing" or "vite" matching "invite".
 * Handles compound keyword variants (e.g. "full stack" matches "fullstack").
 * Text should already be normalizeText()'d before calling this.
 */
function keywordMatchesText(keyword: string, text: string): boolean {
  if (keyword.length <= 1) return false;

  const variants = getKeywordVariants(keyword);

  for (const variant of variants) {
    const escaped = escapeRegex(variant);
    const pattern = variant.length <= 3
      ? new RegExp(`(?:^|[\\s,;|/()\\[\\]:\\-])${escaped}(?:[\\s,;|/()\\[\\]:\\-.]|$)`, "i")
      : new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, "i");
    if (pattern.test(text)) return true;

    // Squished matching: "next.js" matches "nextjs" and vice versa
    if (variant.length > 2 && /[\s.\-_]/.test(variant)) {
      const squished = variant.replace(/[\s.\-_]/g, "");
      if (squished.length > 2 && text.replace(/[\s.\-_]/g, "").includes(squished)) return true;
    }
  }
  return false;
}

const REMOTE_INDICATORS = [
  "remote", "worldwide", "anywhere", "global", "work from home",
  "distributed", "wfh", "telecommute", "home-based", "home based",
];

function isRemoteLocation(locationLower: string): boolean {
  return REMOTE_INDICATORS.some((r) => locationLower.includes(r));
}

const COUNTRY_CODES: Record<string, string> = {
  pk: "pakistan", pak: "pakistan",
  us: "united states", usa: "united states",
  uk: "united kingdom", gb: "united kingdom", gbr: "united kingdom",
  de: "germany", deu: "germany",
  in: "india", ind: "india",
  ca: "canada", can: "canada",
  au: "australia", aus: "australia",
  fr: "france", fra: "france",
  es: "spain", esp: "spain",
  br: "brazil", bra: "brazil",
  cn: "china", chn: "china",
  jp: "japan", jpn: "japan",
  sg: "singapore", sgp: "singapore",
  nl: "netherlands", nld: "netherlands",
  ie: "ireland", irl: "ireland",
  se: "sweden", swe: "sweden",
  ch: "switzerland", che: "switzerland",
  il: "israel", isr: "israel",
  ae: "uae", uae: "uae",
  ng: "nigeria", nga: "nigeria",
  ke: "kenya", ken: "kenya",
  za: "south africa", zaf: "south africa",
  eg: "egypt", egy: "egypt",
  tr: "turkey", tur: "turkey",
  mx: "mexico", mex: "mexico",
  ar: "argentina", arg: "argentina",
  cl: "chile", chl: "chile",
  co: "colombia", col: "colombia",
  id: "indonesia", idn: "indonesia",
  ph: "philippines", phl: "philippines",
  vn: "vietnam", vnm: "vietnam",
  th: "thailand", tha: "thailand",
  my: "malaysia", mys: "malaysia",
  bd: "bangladesh", bgd: "bangladesh",
  lk: "sri lanka", lka: "sri lanka",
  np: "nepal", npl: "nepal",
  sa: "saudi arabia", ksa: "saudi arabia",
  qa: "qatar", qat: "qatar",
  kw: "kuwait", kwt: "kuwait",
  bh: "bahrain", bhr: "bahrain",
  om: "oman", omn: "oman",
  jo: "jordan", jor: "jordan",
  lb: "lebanon", lbn: "lebanon",
  ma: "morocco", mar: "morocco",
  tn: "tunisia", tun: "tunisia",
  ro: "romania", rou: "romania",
  pl: "poland", pol: "poland",
  cz: "czech republic", cze: "czech republic",
  at: "austria", aut: "austria",
  be: "belgium", bel: "belgium",
  dk: "denmark", dnk: "denmark",
  fi: "finland", fin: "finland",
  no: "norway", nor: "norway",
  pt: "portugal", prt: "portugal",
  it: "italy", ita: "italy",
  gr: "greece", grc: "greece",
  hu: "hungary", hun: "hungary",
  nz: "new zealand", nzl: "new zealand",
  ua: "ukraine", ukr: "ukraine",
  tw: "taiwan", twn: "taiwan",
  hk: "hong kong", hkg: "hong kong",
  kr: "south korea", kor: "south korea",
};

function locationMatchesCountryCode(locationLower: string, userCountryLower: string): boolean {
  const parts = locationLower.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
  const lastPart = parts[parts.length - 1] ?? "";
  const resolved = COUNTRY_CODES[lastPart];
  if (resolved && resolved === userCountryLower) return true;
  for (const [code, country] of Object.entries(COUNTRY_CODES)) {
    if (country === userCountryLower && locationLower.includes(code.toUpperCase())) {
      const codePattern = new RegExp(`\\b${code}\\b`, "i");
      if (codePattern.test(locationLower) && code.length === 2) return true;
    }
  }
  return false;
}

export function computeMatchScore(
  job: GlobalJobLike,
  settings: UserSettingsLike,
  resumes: Array<ResumeLike & { id: string }>
): MatchResult {
  const reasons: string[] = [];
  const titleLower = normalizeText(job.title);
  const descLower = normalizeText(job.description || "");
  const locationLower = normalizeText(job.location || "");
  const skillsLower = (job.skills ?? []).map((s) => normalizeText(s)).join(" ");
  const combined = `${titleLower} ${descLower} ${skillsLower}`;
  const hasDescription = !!job.description && job.description.trim().length > 30;

  // ════════════════════════════════════════════
  // HARD FILTER 1: Platform (case-insensitive so "LinkedIn" matches "linkedin")
  // ════════════════════════════════════════════
  const platforms = (settings.preferredPlatforms ?? []).map((p) => (p || "").toLowerCase().trim()).filter(Boolean);
  const jobSourceLower = (job.source || "").toLowerCase().trim();
  if (platforms.length > 0 && jobSourceLower && !platforms.includes(jobSourceLower)) {
    return { ...REJECT, reasons: ["Platform not selected"] };
  }

  // ════════════════════════════════════════════
  // HARD FILTER: Company Blacklist
  // ════════════════════════════════════════════
  const blacklist = (settings.blacklistedCompanies ?? []).map((c) => c.toLowerCase().trim()).filter(Boolean);
  if (blacklist.length > 0) {
    const companyLower = normalizeText(job.company);
    if (blacklist.some((bl) => companyLower.includes(bl) || bl.includes(companyLower))) {
      return { ...REJECT, reasons: ["Blacklisted company"] };
    }
  }

  // ════════════════════════════════════════════
  // HARD FILTER 2: At least 1 keyword MUST match in title, description, or skills
  // ════════════════════════════════════════════
  const userKeywords = (settings.keywords ?? []).map((k) => k.toLowerCase().trim()).filter(Boolean);
  const matchedKeywords = userKeywords.filter(
    (kw) => keywordMatchesText(kw, titleLower) || keywordMatchesText(kw, descLower) || keywordMatchesText(kw, skillsLower)
  );
  const titleKeywords = userKeywords.filter((kw) => keywordMatchesText(kw, titleLower));

  if (userKeywords.length > 0 && matchedKeywords.length === 0) {
    return { ...REJECT, reasons: ["No keyword match"] };
  }

  // ════════════════════════════════════════════
  // HARD FILTER 3: Category
  // ════════════════════════════════════════════
  const prefCats = settings.preferredCategories ?? [];
  const GENERIC_TECH_CATS = new Set(["software engineering", "general", "other", ""]);
  if (prefCats.length > 0) {
    const userCats = prefCats.map((c) => c.toLowerCase());
    const jobCat = (job.category || "").toLowerCase();

    // Skip category filter for generic/uncategorized jobs — let keyword filter handle them
    if (!GENERIC_TECH_CATS.has(jobCat)) {
      const directCatMatch = jobCat && userCats.some(
        (c) => c === jobCat || jobCat.includes(c) || c.includes(jobCat)
      );

      if (!directCatMatch) {
        if (prefCats.length < 15) {
          const catKeywords = userCats.flatMap((c) =>
            c.split(/[\s/]+/).filter((w) => w.length > 3 && !CATEGORY_STOP_WORDS.has(w))
          );
          const fuzzyCatMatch = catKeywords.some((ck) => keywordMatchesText(ck, combined));
          if (!fuzzyCatMatch) {
            return { ...REJECT, reasons: ["Category mismatch"] };
          }
        }
      }
    }
  }

  // ════════════════════════════════════════════
  // HARD FILTER 4: Location — reject non-remote jobs from different countries
  // ════════════════════════════════════════════
  if (settings.country && locationLower) {
    const countryLower = settings.country.toLowerCase();
    const isRemote = isRemoteLocation(locationLower);
    const isInCountry = locationLower.includes(countryLower) ||
      locationMatchesCountryCode(locationLower, countryLower);

    const knownCountries = [
      "india", "usa", "united states", "uk", "united kingdom", "germany",
      "canada", "australia", "france", "spain", "brazil", "china",
      "japan", "singapore", "netherlands", "ireland", "sweden", "switzerland",
      "israel", "uae", "dubai", "saudi", "qatar", "nigeria", "kenya",
      "south africa", "egypt", "turkey", "mexico", "argentina", "chile",
      "colombia", "indonesia", "philippines", "vietnam", "thailand", "malaysia",
    ];

    const locationMentionsForeignCountry = knownCountries.some(
      (c) => c !== countryLower && locationLower.includes(c)
    );

    if (!isRemote && !isInCountry && locationMentionsForeignCountry) {
      return { ...REJECT, reasons: ["Wrong country"] };
    }
  }

  // ════════════════════════════════════════════
  // HARD FILTER 5: City — when user set a city, only allow that city or remote
  // ════════════════════════════════════════════
  const userCityRaw = (settings.city ?? "").trim().toLowerCase();
  const userCity = userCityRaw.split(",")[0]?.trim() ?? "";
  if (userCity && locationLower) {
    const isRemote = isRemoteLocation(locationLower);
    const isUserCity = locationLower.includes(userCity);
    const isCountryOnly = settings.country &&
      locationLower.includes(settings.country.toLowerCase()) &&
      locationLower.split(/[\s,]+/).filter(Boolean).length <= 2;
    const unspecified = !locationLower || locationLower === "n/a" || locationLower === "not specified";

    if (!isRemote && !isUserCity && !isCountryOnly && !unspecified) {
      return { ...REJECT, reasons: ["Wrong location"] };
    }
  }

  // ════════════════════════════════════════════
  // SCORING — Only jobs that passed all hard filters get scored
  // ════════════════════════════════════════════
  let score = 0;

  // Factor 1: KEYWORD MATCH (0-30 points)
  // When description is empty, only title keywords are matchable, so use a
  // reduced denominator to avoid unfairly punishing data-sparse jobs.
  if (matchedKeywords.length > 0) {
    const effectiveDenominator = !hasDescription && titleKeywords.length > 0
      ? Math.min(userKeywords.length, Math.max(titleKeywords.length * 3, 5))
      : userKeywords.length;
    const keywordRatio = matchedKeywords.length / effectiveDenominator;
    let keywordScore = Math.round(Math.min(keywordRatio, 1) * 30);
    if (userKeywords.length > 10) {
      const penaltyFactor = Math.max(0.7, 1 - (userKeywords.length - 10) * 0.03);
      keywordScore = Math.round(keywordScore * penaltyFactor);
    }
    score += keywordScore;
    reasons.push(`Keywords: ${matchedKeywords.slice(0, 5).join(", ")} (${matchedKeywords.length}/${userKeywords.length})`);
  }

  // Factor 2: TITLE RELEVANCE (0-20 points, boosted to 0-25 when description is empty)
  if (titleKeywords.length > 0) {
    const titleMax = hasDescription ? 20 : 25;
    const perKeyword = hasDescription ? 10 : 12;
    score += Math.min(titleMax, titleKeywords.length * perKeyword);
    reasons.push(`Title match: ${titleKeywords.slice(0, 3).join(", ")}`);
  }

  // Factor 3: SKILL MATCH from resume (0-20 points)
  let bestResumeId: string | null = null;
  let bestResumeName: string | null = null;
  let bestResumeScore = 0;

  for (const resume of resumes) {
    if (!resume.content) continue;
    const resumeLower = resume.content.toLowerCase();

    const jSkills = job.skills ?? [];
    const jobSkills = jSkills.length > 0
      ? jSkills
      : extractKeywordsFromText(combined);

    let matchCount = 0;
    for (const skill of jobSkills) {
      if (resumeLower.includes(skill.toLowerCase())) matchCount++;
    }

    const resumeKeywords = new Set(
      resumeLower.split(/[\s,;|]+/).filter((w) => w.length > 3)
    );
    let resumeHits = 0;
    for (const rk of Array.from(resumeKeywords).slice(0, 50)) {
      if (combined.includes(rk)) resumeHits++;
    }

    const rScore = jobSkills.length > 0
      ? (matchCount / jobSkills.length) * 0.7 + Math.min(resumeHits / 20, 1) * 0.3
      : Math.min(resumeHits / 15, 1);

    if (rScore > bestResumeScore) {
      bestResumeScore = rScore;
      bestResumeId = resume.id;
      bestResumeName = resume.name;
    }
  }

  if (bestResumeScore > 0) {
    const skillPoints = Math.round(bestResumeScore * 20);
    score += skillPoints;
    if (bestResumeName) {
      reasons.push(`Skills via ${bestResumeName} (+${skillPoints})`);
    }
  }

  // Factor 4: CATEGORY MATCH (0-10 points)
  const scoreCats = settings.preferredCategories ?? [];
  if (scoreCats.length > 0 && job.category) {
    const userCats = scoreCats.map((c) => c.toLowerCase());
    const jobCat = job.category.toLowerCase();
    if (userCats.some((c) => c === jobCat || jobCat.includes(c) || c.includes(jobCat))) {
      score += 10;
      reasons.push(`Category: ${job.category}`);
    } else {
      score += 3;
      reasons.push("Category: partial match");
    }
  }

  // Factor 5: LOCATION MATCH (0-10 points) / PENALTY
  if (settings.city || settings.country) {
    const cityLower = settings.city?.toLowerCase() ?? "";
    const countryLower = settings.country?.toLowerCase() ?? "";
    const cityMatch = cityLower && locationLower.includes(cityLower);
    const countryMatch = countryLower && (
      locationLower.includes(countryLower) ||
      locationMatchesCountryCode(locationLower, countryLower)
    );
    const remoteMatch = isRemoteLocation(locationLower) &&
      (settings.workType ?? []).includes("remote");

    if (cityMatch) {
      score += 10;
      reasons.push(`Location: ${settings.city}`);
    } else if (remoteMatch) {
      score += 5;
      reasons.push("Remote work match");
    } else if (countryMatch) {
      score += 7;
      reasons.push(`Country: ${settings.country}`);
    } else if (!locationLower || locationLower === "n/a" || locationLower === "not specified") {
      // Unknown location — no bonus but no penalty either
    } else {
      score = Math.max(score - 15, 0);
      reasons.push("Location mismatch (\u221215)");
    }
  }

  // Factor 6: EXPERIENCE LEVEL MATCH (0-5 points)
  if (settings.experienceLevel) {
    const expLower = settings.experienceLevel.toLowerCase();
    const expKeywords: Record<string, string[]> = {
      entry: ["junior", "entry", "intern", "graduate", "fresh", "0-2"],
      mid: ["mid", "intermediate", "2-4", "3-5", "2+"],
      senior: ["senior", "lead", "principal", "staff", "5+", "7+", "8+"],
      lead: ["lead", "principal", "staff", "director", "head", "architect", "8+"],
    };
    const matchers = expKeywords[expLower] || [expLower];
    if (matchers.some((kw) => combined.includes(kw))) {
      score += 5;
      reasons.push(`Experience: ${settings.experienceLevel}`);
    }
  }

  // Factor 7: FRESHNESS BONUS (0-5 points) — only if job has title keyword match
  if (titleKeywords.length > 0) {
    if (job.firstSeenAt) {
      const daysSince = (Date.now() - new Date(job.firstSeenAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 1) {
        score += 5;
        reasons.push("Freshness: Posted today (+5)");
      } else if (daysSince < 3) {
        score += 3;
        reasons.push("Freshness: Recent (+3)");
      } else if (daysSince < 7) {
        score += 1;
      }
    } else if (job.isFresh) {
      score += 5;
      reasons.push("Freshness: Posted today (+5)");
    }
  }

  score = Math.min(score, 100);

  return { score, reasons, bestResumeId, bestResumeName };
}

function extractKeywordsFromText(text: string): string[] {
  const techTerms = [
    "react", "vue", "angular", "next.js", "node.js", "express", "nestjs",
    "typescript", "javascript", "python", "java", "c#", "go", "rust", "ruby",
    "php", "swift", "kotlin", "flutter", "react native",
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
    "graphql", "rest", "microservices", "ci/cd", "git",
    "tailwind", "sass", "html", "css", "figma",
    "machine learning", "deep learning", "nlp", "tensorflow", "pytorch",
    "django", "flask", "spring", "laravel", ".net",
  ];
  return techTerms.filter((t) => text.includes(t));
}
