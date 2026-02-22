import { prisma } from "../lib/prisma";

async function main() {
  const apps = await prisma.jobApplication.findMany({
    where: { userId: "cmlwe8if30000nrkk3ldmjjni" },
    select: { id: true, subject: true, emailBody: true, status: true, recipientEmail: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  for (const a of apps) {
    console.log("---", a.id, a.status);
    console.log("To:", a.recipientEmail);
    console.log("Subject:", a.subject?.slice(0, 100));
    console.log("Body first 150:", a.emailBody?.slice(0, 150));
    const hasJson = a.emailBody?.includes('{"') || a.emailBody?.includes("{'");
    console.log("Contains JSON braces:", hasJson);
    console.log();
  }

  await prisma.$disconnect();
}

main().catch(console.error);
