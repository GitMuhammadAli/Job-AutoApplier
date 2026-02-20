import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "alishahid.works@gmail.com" },
  });

  if (!user) {
    console.log("No user found");
    await prisma.$disconnect();
    return;
  }

  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const token = "test-session-" + Date.now();

  await prisma.session.create({
    data: { userId: user.id, sessionToken: token, expires },
  });

  console.log("Session token:", token);
  console.log("User ID:", user.id);
  console.log(
    "\nSet this cookie in browser:",
    `next-auth.session-token=${token}`
  );

  await prisma.$disconnect();
}

main().catch(console.error);
