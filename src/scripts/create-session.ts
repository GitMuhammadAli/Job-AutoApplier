import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  console.error("This script must NOT be run in production.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();

  if (!user) {
    console.log("No user found");
    await prisma.$disconnect();
    return;
  }

  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const token = "dev-session-" + Date.now();

  await prisma.session.create({
    data: { userId: user.id, sessionToken: token, expires },
  });

  console.log("Dev session created. Token starts with:", token.slice(0, 15) + "...");
  console.log("Set cookie: next-auth.session-token=<token>");

  await prisma.$disconnect();
}

main().catch(console.error);
