import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  // Verify n8n API key
  const apiKey = req.headers.get("x-n8n-secret") || req.headers.get("x-n8n-api-key");
  if (process.env.N8N_API_KEY && apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const user = await prisma.user.findUnique({
      where: { email: "ali@demo.com" },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    switch (action) {
      case "new_job_found": {
        const { company, role, url, platform, notes } = body;

        // Check for duplicates
        if (url) {
          const existing = await prisma.job.findFirst({
            where: { userId: user.id, url },
          });
          if (existing) {
            return NextResponse.json({ message: "Job already exists", id: existing.id });
          }
        }

        const job = await prisma.job.create({
          data: {
            company: company || "Unknown",
            role: role || "Unknown Role",
            url: url || null,
            platform: platform || "OTHER",
            stage: "SAVED",
            notes: notes || null,
            userId: user.id,
          },
        });

        await prisma.activity.create({
          data: {
            jobId: job.id,
            type: "job_created",
            toStage: "SAVED",
            note: "Created via n8n webhook",
            metadata: { automated: true, source: "n8n" },
          },
        });

        return NextResponse.json({ success: true, id: job.id });
      }

      case "get_stale_applications": {
        const settings = await prisma.userSettings.findUnique({
          where: { userId: user.id },
        });
        const staleDays = settings?.staleDays ?? 7;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - staleDays);

        const staleJobs = await prisma.job.findMany({
          where: {
            userId: user.id,
            stage: "APPLIED",
            appliedDate: { lte: cutoff },
          },
          select: { id: true, company: true, role: true, appliedDate: true, url: true },
        });

        return NextResponse.json({ jobs: staleJobs, count: staleJobs.length });
      }

      case "detect_ghosts": {
        const settings = await prisma.userSettings.findUnique({
          where: { userId: user.id },
        });
        const ghostDays = settings?.ghostDays ?? 14;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - ghostDays);

        const ghosted = await prisma.job.findMany({
          where: {
            userId: user.id,
            stage: "APPLIED",
            appliedDate: { lte: cutoff },
            isGhosted: false,
          },
        });

        for (const job of ghosted) {
          await prisma.$transaction([
            prisma.job.update({
              where: { id: job.id },
              data: { stage: "GHOSTED", isGhosted: true },
            }),
            prisma.activity.create({
              data: {
                jobId: job.id,
                type: "ghost_detected",
                fromStage: "APPLIED",
                toStage: "GHOSTED",
                note: `Auto-ghosted via n8n after ${ghostDays} days`,
                metadata: { automated: true },
              },
            }),
          ]);
        }

        return NextResponse.json({
          message: `${ghosted.length} jobs marked as ghosted`,
          count: ghosted.length,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
