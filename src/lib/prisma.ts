import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    process.env.NODE_ENV !== "production"
      ? { log: [{ emit: "stdout", level: "query" }] }
      : undefined,
  );

globalForPrisma.prisma = prisma;
