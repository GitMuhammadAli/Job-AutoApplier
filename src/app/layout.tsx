import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { KeyboardShortcuts } from "@/components/shared/KeyboardShortcuts";
import "./globals.css";

// Clash Display — display/marquee headlines only (≥24px). Self-hosted from Fontshare.
const clashDisplay = localFont({
  src: [
    { path: "../../public/fonts/ClashDisplay-Medium.woff2",   weight: "500", style: "normal" },
    { path: "../../public/fonts/ClashDisplay-Semibold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/ClashDisplay-Bold.woff2",     weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

// General Sans — body, UI, small labels. Pairs with Clash Display (same foundry).
const generalSans = localFont({
  src: [
    { path: "../../public/fonts/GeneralSans-Regular.woff2",  weight: "400", style: "normal" },
    { path: "../../public/fonts/GeneralSans-Medium.woff2",   weight: "500", style: "normal" },
    { path: "../../public/fonts/GeneralSans-Semibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

// JetBrains Mono — code, file paths, tabular numbers in UI.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "JobPilot - Automated Job Application Tracker",
  description:
    "Track job applications with a Kanban board, automated job scraping from 8 sources, per-job email alerts with resume recommendations, and analytics.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JobPilot",
  },
  icons: {
    icon: [
      { url: "/icon", type: "image/png" },
      { url: "/favicon.svg?v=jp1", type: "image/svg+xml" },
    ],
    apple: { url: "/apple-icon", sizes: "180x180" },
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${clashDisplay.variable} ${generalSans.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Favicon + apple-touch-icon now handled by metadata.icons above. */}
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              prerender: [{ where: { href_matches: "/*" }, eagerness: "moderate" }],
              prefetch: [{ where: { href_matches: "/api/*" }, eagerness: "moderate" }],
            }),
          }}
        />
      </head>
      <body className={`${generalSans.className} antialiased`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg">
          Skip to main content
        </a>
        <SessionProvider>
          <ThemeProvider>
            {children}
            <KeyboardShortcuts />
            <Toaster richColors position="bottom-right" />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
