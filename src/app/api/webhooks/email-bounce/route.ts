import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface BrevoBounceEvent {
  event?: string;
  email?: string;
  reason?: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BrevoBounceEvent;
    const eventType = body.event;
    const email = body.email;
    const reason = body.reason || "Bounce received";

    if (eventType !== "hard_bounce" && eventType !== "soft_bounce") {
      return NextResponse.json({ received: true });
    }

    if (!email) {
      return NextResponse.json({ received: true });
    }

    const applications = await prisma.jobApplication.findMany({
      where: {
        recipientEmail: email,
        status: "SENT",
      },
      include: { userJob: { select: { globalJobId: true } } },
    });

    for (const app of applications) {
      await prisma.$transaction([
        prisma.jobApplication.update({
          where: { id: app.id },
          data: {
            status: "BOUNCED",
            errorMessage: reason,
          },
        }),
      ]);
    }

    const globalJobIds = Array.from(new Set(applications.map((a) => a.userJob.globalJobId)));
    if (globalJobIds.length > 0) {
      await prisma.globalJob.updateMany({
        where: { id: { in: globalJobIds } },
        data: { companyEmail: null },
      });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Email bounce webhook error:", error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
