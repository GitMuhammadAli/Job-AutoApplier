"use server";

import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const feedbackSchema = z.object({
  type: z.enum(["bug", "suggestion", "compliment", "other"]),
  message: z.string().min(5).max(2000),
  page: z.string().max(200).optional(),
});

export async function submitFeedback(data: z.infer<typeof feedbackSchema>) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  const parsed = feedbackSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Invalid feedback data" };
  }

  await prisma.userFeedback.create({
    data: {
      userId: session.user.id,
      type: parsed.data.type,
      message: parsed.data.message,
      page: parsed.data.page,
    },
  });

  return { success: true };
}
