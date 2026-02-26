import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JobPilot - Job Application Tracker",
    short_name: "JobPilot",
    description: "Track job applications with automated scraping, AI-powered emails, and a Kanban board.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    share_target: {
      action: "/jobs/new",
      method: "GET",
      params: {
        url: "shared_url",
        text: "shared_text",
        title: "shared_title",
      },
    } as any,
  };
}
