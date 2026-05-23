import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import EmailProvider from "next-auth/providers/email";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [GitHubProvider({
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        })]
      : []),
    EmailProvider({
      server: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      from: `"JobPilot" <${process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER || "notifications@jobpilot.app"}>`,
    }),
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.email = user.email;
        session.user.name = user.name;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await prisma.userSettings.create({
          data: { userId: user.id },
        });
      }
    },
  },
};

/**
 * Throwable Response sentinel — Next.js route handlers catch a thrown `Response`
 * and return it verbatim, so this surfaces as a real 401 instead of a 500.
 */
export class UnauthenticatedError extends Error {
  readonly response: Response;
  constructor() {
    super("Not authenticated");
    this.response = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}

export async function getAuthUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthenticatedError();
  return session.user.id;
}

export async function getAuthSession() {
  return getServerSession(authOptions);
}

/**
 * Helper for route handlers that want the userId-or-401 pattern without try/catch.
 * Returns either `{ userId }` or `{ response }` — never both.
 */
export async function requireAuthUserId(): Promise<
  { userId: string; response?: never } | { userId?: never; response: Response }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { userId: session.user.id };
}
