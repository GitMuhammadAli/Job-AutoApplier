import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aggregateSearchQueries } from "@/lib/scrapers/keyword-aggregator";
import { fetchGoogleHiringPosts } from "@/lib/scrapers/google-hiring-posts";
import { scrapeAndUpsert } from "@/lib/scrapers/scrape-source";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/cron-auth";
import { handleRouteError } from "@/lib/api-response";
import { createCronTracker } from "@/lib/cron-tracker";
import { pushUrgentPost, isPushConfigured } from "@/lib/push-notifications";
import { computeMatchScore, MATCH_THRESHOLDS } from "@/lib/matching/score-engine";
import { decryptSettingsFields, hasDecryptionFailure } from "@/lib/encryption";
import type { SearchQuery } from "@/types";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const tracker = createCronTracker("scrape-posts");

  try {
    const queries = await aggregateSearchQueries();
    if (queries.length === 0) {
      return NextResponse.json({ message: "No user keywords configured", scraped: 0 });
    }

    const result = await scrapeAndUpsert(
      "linkedin_posts",
      (q: SearchQuery[]) => fetchGoogleHiringPosts(q),
      queries,
    );

    await prisma.systemLog.create({
      data: {
        type: "scrape",
        source: "linkedin_posts",
        message: `Posts: ${result.newCount} new, ${result.updatedCount} updated`,
        metadata: { newCount: result.newCount, updatedCount: result.updatedCount },
      },
    });

    let pushSent = 0;

    if (result.newCount > 0 && isPushConfigured()) {
      const recentPosts = await prisma.globalJob.findMany({
        where: {
          source: "linkedin_posts",
          isFresh: true,
          isActive: true,
          createdAt: { gte: new Date(Date.now() - 20 * 60 * 1000) },
        },
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          description: true,
          skills: true,
          sourceUrl: true,
          category: true,
          experienceLevel: true,
          salary: true,
          jobType: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      if (recentPosts.length > 0) {
        const usersWithPush = await prisma.userSettings.findMany({
          where: {
            pushNotifications: true,
            isOnboarded: true,
            accountStatus: "active",
            keywords: { isEmpty: false },
          },
          take: 50,
        });

        for (const rawSettings of usersWithPush) {
          const settings = decryptSettingsFields(rawSettings);
          if (hasDecryptionFailure(settings as Record<string, unknown>, "fullName")) continue;

          for (const post of recentPosts) {
            const { score } = computeMatchScore(post, settings, []);

            if (score >= MATCH_THRESHOLDS.SHOW_ON_KANBAN) {
              await pushUrgentPost(
                settings.userId,
                post.title,
                post.company,
                post.sourceUrl || "/recommended",
              ).catch(() => {});
              pushSent++;
              break;
            }
          }
        }
      }
    }

    await tracker.success({
      processed: result.newCount,
      metadata: { updated: result.updatedCount, pushSent },
    });

    return NextResponse.json({
      success: true,
      source: "linkedin_posts",
      ...result,
      pushSent,
    });
  } catch (error) {
    await tracker.error(error instanceof Error ? error : String(error));
    return handleRouteError("ScrapePosts", error, "LinkedIn posts scrape failed");
  }
}
