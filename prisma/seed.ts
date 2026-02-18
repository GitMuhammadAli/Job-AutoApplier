import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "ali@demo.com" },
    update: {},
    create: {
      email: "ali@demo.com",
      name: "Muhammad Ali Shahid",
      settings: {
        create: {
          keywords: ["MERN", "NestJS", "Next.js", "React", "Node.js"],
          city: "Lahore",
          country: "Pakistan",
          preferredCategories: ["Full Stack Development", "Frontend Development", "Backend Development"],
          preferredPlatforms: ["jsearch", "indeed", "remotive", "linkedin"],
        },
      },
    },
  });

  const resumeNames = ["Full-Stack", "Backend", "Frontend", "MERN", "JavaScript", "TypeScript", "ASC", "General"];
  for (const name of resumeNames) {
    await prisma.resume.upsert({
      where: { id: `seed-${name}` },
      update: {},
      create: { id: `seed-${name}`, name, userId: user.id },
    });
  }

  console.log("Seeded: 1 user, 8 resumes");
}

main().catch(console.error).finally(() => prisma.$disconnect());
