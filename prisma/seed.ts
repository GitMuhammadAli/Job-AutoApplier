import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.upsert({
    where: { email: "ali@demo.com" }, update: {},
    create: { email: "ali@demo.com", name: "Muhammad Ali Shahid",
      settings: { create: { dailyTarget: 5, followUpDays: 5, ghostDays: 14, searchKeywords: "MERN,NestJS,Next.js,React,Node.js", searchLocation: "Lahore" } } },
  });
  const resumeNames = ["Full-Stack","Backend","Frontend","MERN","JavaScript","TypeScript","ASC","General"];
  const resumes: Record<string, string> = {};
  for (const name of resumeNames) {
    const r = await prisma.resume.upsert({ where: { userId_name: { userId: user.id, name } }, update: {}, create: { name, userId: user.id } });
    resumes[name] = r.id;
  }
  const jobs = [
    { company: "Cyngro", role: "Junior MERN Stack Developer", platform: "INDEED" as const, location: "Lahore", workType: "ONSITE" as const, notes: "NestJS + Next.js exact match", resumeId: resumes["Full-Stack"] },
    { company: "Bridgeway Solution", role: "Full-Stack TypeScript Developer", platform: "GLASSDOOR" as const, location: "Remote", workType: "REMOTE" as const, resumeId: resumes["TypeScript"] },
    { company: "ThinKASA", role: "Full Stack Developer", platform: "GLASSDOOR" as const, location: "Remote", workType: "REMOTE" as const, resumeId: resumes["MERN"] },
    { company: "Contour Software", role: "Frontend (React) Developer", platform: "GLASSDOOR" as const, location: "Lahore", workType: "ONSITE" as const, resumeId: resumes["Frontend"] },
    { company: "ReownLogics", role: "Jr. React.js Developer", platform: "GLASSDOOR" as const, location: "Lahore", workType: "ONSITE" as const, resumeId: resumes["Frontend"] },
  ];
  for (const job of jobs) { await prisma.job.create({ data: { ...job, stage: "SAVED", userId: user.id } }); }
  console.log("✅ Seeded: 1 user, 8 resumes, 5 jobs");
}
main().catch(console.error).finally(() => prisma.$disconnect());
