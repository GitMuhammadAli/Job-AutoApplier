import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedTestData() {
  console.log("Starting test seed...");

  const testEmail = "alishahid.works@gmail.com";

  let user = await prisma.user.findUnique({ where: { email: testEmail } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Ali Shahid",
        emailVerified: new Date(),
      },
    });
    console.log("[+] Created test user:", user.id);
  } else {
    console.log("[+] Found existing user:", user.id);
  }

  // ── UserSettings (matches actual schema) ──

  const settings = await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {
      fullName: "Ali Shahid",
      phone: "+92 300 1234567",
      linkedinUrl: "https://linkedin.com/in/alishahid-fswebdev",
      githubUrl: "https://github.com/GitMuhammadAli",
      portfolioUrl: "https://alishahid-dev.vercel.app",
      keywords: ["React", "Node.js", "Full Stack", "TypeScript", "Next.js"],
      city: "Lahore",
      country: "Pakistan",
      salaryMin: 50000,
      salaryMax: 200000,
      salaryCurrency: "USD",
      experienceLevel: "mid",
      education: "bachelor",
      workType: ["remote", "hybrid"],
      jobType: ["fulltime", "contract"],
      languages: ["English", "Urdu"],
      preferredCategories: [
        "Frontend Development",
        "Backend Development",
        "Full Stack Development",
      ],
      preferredPlatforms: [
        "indeed",
        "remotive",
        "arbeitnow",
        "rozee",
        "linkedin",
        "jsearch",
        "adzuna",
        "google",
      ],
      emailNotifications: true,
      notificationEmail: testEmail,
      notificationFrequency: "hourly",
      emailProvider: "gmail",
      smtpUser: testEmail,
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      applicationMode: "SEMI_AUTO",
      autoApplyEnabled: false,
      sendDelaySeconds: 120,
      maxSendsPerHour: 8,
      maxSendsPerDay: 20,
      cooldownMinutes: 30,
      bouncePauseHours: 24,
      instantApplyDelay: 5,
      minMatchScoreForAutoApply: 70,
      resumeMatchMode: "smart",
      preferredTone: "professional",
      emailLanguage: "English",
      includeLinkedin: true,
      includeGithub: true,
      includePortfolio: false,
      customClosing: "Best regards,\nAli Shahid",
      accountStatus: "active",
      isOnboarded: true,
    },
    create: {
      userId: user.id,
      fullName: "Ali Shahid",
      phone: "+92 300 1234567",
      linkedinUrl: "https://linkedin.com/in/alishahid-fswebdev",
      githubUrl: "https://github.com/GitMuhammadAli",
      portfolioUrl: "https://alishahid-dev.vercel.app",
      keywords: ["React", "Node.js", "Full Stack", "TypeScript", "Next.js"],
      city: "Lahore",
      country: "Pakistan",
      salaryMin: 50000,
      salaryMax: 200000,
      salaryCurrency: "USD",
      experienceLevel: "mid",
      education: "bachelor",
      workType: ["remote", "hybrid"],
      jobType: ["fulltime", "contract"],
      languages: ["English", "Urdu"],
      preferredCategories: [
        "Frontend Development",
        "Backend Development",
        "Full Stack Development",
      ],
      preferredPlatforms: [
        "indeed",
        "remotive",
        "arbeitnow",
        "rozee",
        "linkedin",
        "jsearch",
        "adzuna",
        "google",
      ],
      emailNotifications: true,
      notificationEmail: testEmail,
      notificationFrequency: "hourly",
      emailProvider: "gmail",
      smtpUser: testEmail,
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      applicationMode: "SEMI_AUTO",
      autoApplyEnabled: false,
      sendDelaySeconds: 120,
      maxSendsPerHour: 8,
      maxSendsPerDay: 20,
      cooldownMinutes: 30,
      bouncePauseHours: 24,
      instantApplyDelay: 5,
      minMatchScoreForAutoApply: 70,
      resumeMatchMode: "smart",
      preferredTone: "professional",
      emailLanguage: "English",
      includeLinkedin: true,
      includeGithub: true,
      includePortfolio: false,
      customClosing: "Best regards,\nAli Shahid",
      accountStatus: "active",
      isOnboarded: true,
    },
  });
  console.log("[+] UserSettings configured (id:", settings.id, ")");

  // ── GlobalJobs ──

  const now = new Date();
  const testJobs = [
    // === SHOULD MATCH (keywords + categories align) ===
    {
      sourceId: "test-job-001",
      source: "remotive",
      title: "Senior React Developer",
      company: "TechCorp Inc",
      location: "Remote",
      description:
        "We are looking for a Senior React Developer with experience in TypeScript, Next.js, and Node.js. You will build modern web applications using React hooks, server-side rendering, and REST APIs. Experience with Tailwind CSS and PostgreSQL is a plus.",
      salary: "$120k - $160k",
      skills: ["React", "TypeScript", "Next.js", "Node.js", "PostgreSQL", "Tailwind"],
      category: "Frontend Development",
      sourceUrl: "https://remotive.com/job/001",
      applyUrl: "https://techcorp.com/apply",
      companyEmail: "hr@techcorp.com",
      jobType: "fulltime",
      experienceLevel: "senior",
    },
    {
      sourceId: "test-job-002",
      source: "indeed",
      title: "Full Stack Engineer — Node.js & React",
      company: "StartupXYZ",
      location: "Remote — Worldwide",
      description:
        "Join our growing team as a Full Stack Engineer. We use React on the frontend and Node.js/Express on the backend. TypeScript throughout. GraphQL API. PostgreSQL database. Docker for deployment. Agile team of 8 engineers.",
      salary: "$80k - $120k",
      skills: ["React", "Node.js", "TypeScript", "GraphQL", "Docker", "PostgreSQL"],
      category: "Full Stack Development",
      sourceUrl: "https://indeed.com/job/002",
      applyUrl: "https://startupxyz.com/careers",
      companyEmail: "jobs@startupxyz.com",
      jobType: "fulltime",
      experienceLevel: "mid",
    },
    {
      sourceId: "test-job-003",
      source: "arbeitnow",
      title: "Backend Developer — Node.js",
      company: "CloudSoft Ltd",
      location: "Lahore, Pakistan",
      description:
        "Backend Developer needed for our SaaS platform. Strong Node.js and Express experience required. Work with MongoDB, Redis, and AWS services. CI/CD with GitHub Actions.",
      salary: "PKR 150k - 300k",
      skills: ["Node.js", "Express", "MongoDB", "Redis", "AWS"],
      category: "Backend Development",
      sourceUrl: "https://arbeitnow.com/job/003",
      applyUrl: "https://cloudsoft.pk/apply",
      companyEmail: "hiring@cloudsoft.pk",
      jobType: "fulltime",
      experienceLevel: "mid",
    },
    {
      sourceId: "test-job-004",
      source: "rozee",
      title: "Next.js Frontend Developer",
      company: "DigiPak Solutions",
      location: "Lahore, Pakistan — Hybrid",
      description:
        "Looking for a Next.js developer to join our product team. You'll build the frontend of our B2B SaaS dashboard. Skills: Next.js 14, React, TypeScript, shadcn/ui, Prisma.",
      salary: "PKR 200k - 400k",
      skills: ["Next.js", "React", "TypeScript", "Prisma", "Tailwind"],
      category: "Frontend Development",
      sourceUrl: "https://rozee.pk/job/004",
      applyUrl: "https://digipak.com/careers",
      companyEmail: "talent@digipak.com",
      jobType: "fulltime",
      experienceLevel: "mid",
    },
    {
      sourceId: "test-job-005",
      source: "remotive",
      title: "TypeScript API Developer",
      company: "APIFirst Co",
      location: "Remote — US/EU timezone",
      description:
        "Build robust REST and GraphQL APIs using TypeScript and Node.js. Familiar with Prisma ORM, PostgreSQL, and serverless deployment on Vercel/AWS Lambda.",
      salary: "$90k - $130k",
      skills: ["TypeScript", "Node.js", "Prisma", "PostgreSQL", "GraphQL"],
      category: "Backend Development",
      sourceUrl: "https://remotive.com/job/005",
      applyUrl: "https://apifirst.co/jobs",
      companyEmail: null,
      jobType: "contract",
      experienceLevel: "mid",
    },

    // === SHOULD NOT MATCH (0 keyword overlap) ===
    {
      sourceId: "test-job-006",
      source: "remotive",
      title: "Copywriter — Content Marketing",
      company: "ContentCo",
      location: "Remote",
      description:
        "We need a creative copywriter to write blog posts, landing pages, and email campaigns. Experience with SEO, WordPress, and social media marketing required.",
      salary: "$40k - $60k",
      skills: ["SEO", "WordPress", "Content Writing", "Social Media"],
      category: "Writing",
      sourceUrl: "https://remotive.com/job/006",
      applyUrl: "https://contentco.com/apply",
      companyEmail: null,
      jobType: "fulltime",
      experienceLevel: "mid",
    },
    {
      sourceId: "test-job-007",
      source: "indeed",
      title: "Inside Sales Representative",
      company: "SalesForce Pro",
      location: "Remote",
      description:
        "B2B inside sales role. Cold calling, email outreach, CRM management. Salesforce experience required. Commission-based compensation.",
      salary: "$35k - $55k + commission",
      skills: ["Salesforce", "Cold Calling", "CRM", "B2B Sales"],
      category: "Sales",
      sourceUrl: "https://indeed.com/job/007",
      applyUrl: "https://salesforcepro.com/careers",
      companyEmail: null,
      jobType: "fulltime",
      experienceLevel: "entry",
    },
    {
      sourceId: "test-job-008",
      source: "indeed",
      title: "Office Assistant",
      company: "AdminCorp",
      location: "Remote",
      description:
        "General office assistant duties. Scheduling, email management, data entry, phone calls. Proficiency in Microsoft Office Suite required.",
      salary: "$25k - $35k",
      skills: ["Microsoft Office", "Data Entry", "Scheduling"],
      category: "Operations",
      sourceUrl: "https://indeed.com/job/008",
      applyUrl: "https://admincorp.com/apply",
      companyEmail: null,
      jobType: "fulltime",
      experienceLevel: "entry",
    },

    // === EDGE CASES ===
    {
      sourceId: "test-job-009",
      source: "linkedin",
      title: "Junior React Developer (Internship)",
      company: "InternCo",
      location: "Lahore, Pakistan — On-site",
      description:
        "Internship for fresh graduates. Learn React, HTML, CSS, and JavaScript. 3-month program with possibility of full-time offer.",
      salary: "PKR 30k - 50k",
      skills: ["React", "HTML", "CSS", "JavaScript"],
      category: "Frontend Development",
      sourceUrl: "https://linkedin.com/job/009",
      applyUrl: "https://internco.pk/apply",
      companyEmail: null,
      jobType: "internship",
      experienceLevel: "entry",
    },
    {
      sourceId: "test-job-010",
      source: "arbeitnow",
      title: "DevOps Engineer — Kubernetes & AWS",
      company: "CloudOps",
      location: "Remote",
      description:
        "Manage Kubernetes clusters, CI/CD pipelines, and AWS infrastructure. Terraform, Docker, GitHub Actions. No frontend/backend coding required.",
      salary: "$110k - $150k",
      skills: ["Kubernetes", "AWS", "Terraform", "Docker", "CI/CD"],
      category: "DevOps / SRE",
      sourceUrl: "https://arbeitnow.com/job/010",
      applyUrl: "https://cloudops.io/careers",
      companyEmail: null,
      jobType: "fulltime",
      experienceLevel: "senior",
    },
  ];

  for (const job of testJobs) {
    const isFresh = !["test-job-005"].includes(job.sourceId);
    await prisma.globalJob.upsert({
      where: {
        sourceId_source: { sourceId: job.sourceId, source: job.source },
      },
      update: {
        ...job,
        isActive: true,
        isFresh,
        lastSeenAt: now,
      },
      create: {
        ...job,
        isActive: true,
        isFresh,
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });
  }
  console.log(`[+] Upserted ${testJobs.length} test GlobalJobs`);

  // ── Email Templates ──

  const templates = [
    {
      name: "Professional Standard",
      subject: "Application for {{position}} — {{name}}",
      body: "Dear {{company}} Hiring Team,\n\nI am writing to express my interest in the {{position}} role. With my experience in modern web technologies and a strong background in building scalable applications, I believe I would be a valuable addition to your team.\n\nI have attached my resume for your review and would welcome the opportunity to discuss how my skills align with your team's needs.\n\n{{closing}}",
      isDefault: true,
    },
    {
      name: "Casual & Confident",
      subject: "{{position}} — Let's Chat! | {{name}}",
      body: "Hi {{company}} team,\n\nI came across your {{position}} opening and got excited — it's exactly the kind of role I've been looking for.\n\nI've been building full-stack applications with React, Node.js, and TypeScript for the past few years, and I'd love to bring that experience to {{company}}.\n\nWould love to chat if you think there might be a fit!\n\n{{closing}}",
      isDefault: false,
    },
    {
      name: "Technical Deep Dive",
      subject: "Re: {{position}} at {{company}} — {{name}} (Full Stack)",
      body: "Hello {{company}} Engineering Team,\n\nI noticed your opening for a {{position}} and wanted to reach out. My technical background includes:\n\n- React/Next.js frontend development with TypeScript\n- Node.js backend services with PostgreSQL\n- CI/CD pipelines and containerized deployments\n\nI've attached my resume which details my recent projects.\n\nI'd appreciate the chance to discuss the role further.\n\n{{closing}}",
      isDefault: false,
    },
  ];

  for (const tpl of templates) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { userId: user.id, name: tpl.name },
    });
    if (!existing) {
      await prisma.emailTemplate.create({
        data: {
          ...tpl,
          userId: user.id,
          settingsId: settings.id,
        },
      });
    }
  }
  console.log("[+] Email templates ready");

  // ── Run matching engine on seeded jobs ──

  console.log("\n[*] Running match engine against seeded jobs...\n");

  const { computeMatchScore, MATCH_THRESHOLDS } = await import(
    "../lib/matching/score-engine"
  );

  const allTestJobs = await prisma.globalJob.findMany({
    where: { sourceId: { startsWith: "test-job-" } },
  });

  const resumes = await prisma.resume.findMany({
    where: { userId: user.id, isDeleted: false },
    select: { id: true, name: true, content: true },
  });

  const settingsLike = {
    keywords: settings.keywords,
    city: settings.city,
    country: settings.country,
    experienceLevel: settings.experienceLevel,
    workType: settings.workType,
    jobType: settings.jobType,
    preferredCategories: settings.preferredCategories,
    preferredPlatforms: settings.preferredPlatforms,
    salaryMin: settings.salaryMin,
    salaryMax: settings.salaryMax,
  };

  const existingIds = new Set(
    (
      await prisma.userJob.findMany({
        where: { userId: user.id },
        select: { globalJobId: true },
      })
    ).map((uj) => uj.globalJobId)
  );

  let matched = 0;
  let rejected = 0;

  for (const job of allTestJobs) {
    const result = computeMatchScore(job, settingsLike, resumes);

    const status =
      result.score >= MATCH_THRESHOLDS.SHOW_ON_KANBAN ? "MATCH" : "REJECT";
    const icon = status === "MATCH" ? "[v]" : "[x]";

    console.log(
      `  ${icon} ${job.title.padEnd(45)} score=${String(result.score).padStart(3)}  ${result.reasons.slice(0, 3).join(", ")}`
    );

    if (status === "MATCH" && !existingIds.has(job.id)) {
      await prisma.userJob.create({
        data: {
          userId: user.id,
          globalJobId: job.id,
          stage: "SAVED",
          matchScore: result.score,
          matchReasons: result.reasons,
        },
      });
      matched++;
    } else if (status === "REJECT") {
      rejected++;
    }
  }

  console.log(
    `\n[+] Matching complete: ${matched} matched, ${rejected} rejected`
  );

  // ── Summary ──

  const userJobCount = await prisma.userJob.count({
    where: { userId: user.id },
  });

  console.log("\n========================================");
  console.log("  SEED COMPLETE");
  console.log("========================================\n");
  console.log(`  User:       ${testEmail} (${user.id})`);
  console.log(`  Keywords:   ${settings.keywords.join(", ")}`);
  console.log(`  Categories: ${settings.preferredCategories.join(", ")}`);
  console.log(`  Mode:       ${settings.applicationMode}`);
  console.log(`  Jobs on Kanban: ${userJobCount}`);
  console.log(`  Templates:  3`);
  console.log("");
  console.log("  Expected matching:");
  console.log("    [v] Senior React Developer          ~70-90");
  console.log("    [v] Full Stack Engineer              ~75-95");
  console.log("    [v] Backend Developer (Node.js)      ~50-70");
  console.log("    [v] Next.js Frontend Developer       ~75-90");
  console.log("    [v] TypeScript API Developer          ~45-65");
  console.log("    [v] Junior React Developer (edge)    ~40-55");
  console.log("    [x] Copywriter                      0 (no keyword match)");
  console.log("    [x] Inside Sales Representative     0 (no keyword match)");
  console.log("    [x] Office Assistant                0 (no keyword match)");
  console.log("    [x] DevOps Engineer                 0 (no keyword/category)");
  console.log("");

  await prisma.$disconnect();
}

seedTestData().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
