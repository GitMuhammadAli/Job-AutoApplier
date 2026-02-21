/**
 * Creates a test session for E2E testing.
 * Run: npx tsx scripts/create-test-session.ts
 * Then run: npx tsx e2e-full-test.ts
 */
import { PrismaClient } from "@prisma/client";

const SESSION_TOKEN = "test-session-1771597173969";

async function main() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({
    where: { email: { in: ["alishahid.works@gmail.com", "ali@demo.com"] } },
  });
  if (!user) {
    console.error("No user found. Run db:seed first.");
    process.exit(1);
  }
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  await prisma.session.upsert({
    where: { sessionToken: SESSION_TOKEN },
    update: { expires },
    create: {
      sessionToken: SESSION_TOKEN,
      userId: user.id,
      expires,
    },
  });
  console.log("Test session created for", user.email);
  console.log("Cookie: next-auth.session-token =", SESSION_TOKEN);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
