import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { KeyboardShortcuts } from "@/components/shared/KeyboardShortcuts";
import { CookieConsent } from "@/components/ui/CookieConsent";
import "./globals.css";

// Fraunces — display font for page titles and hero numbers.
// Locked in design system 2026-06-14 (src/styles/tokens.css). Optical-size
// at 80+ gives the warm/organic feel; weights 400-700 cover all use.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  fallback: ["Georgia", "Times New Roman", "serif"],
});

// Inter — UI font for body, labels, and default text.
// (Geist is not yet shipped in next/font/google for Next 14.2; Inter is the
// closest visually-clean Geist-substitute available. Swap to GeistSans from
// the `inter` package if you later upgrade and install it.)
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

// JetBrains Mono — code, log viewers, JSON, file paths, tabular IDs.
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
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Favicon + apple-touch-icon now handled by metadata.icons above. */}
        {/* Speculation rules — scoped to PUBLIC routes only.
            Previously prerendered /* (including authenticated routes and
            server-action mutations) and prefetched /api/* (including
            /api/auth/signout). Tightened per production audit: only the
            marketing surface is eligible for prerender. */}
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              prerender: [
                {
                  where: {
                    href_matches: [
                      "/",
                      "/faq",
                      "/features",
                      "/how-it-works",
                      "/modes",
                      "/privacy",
                      "/terms",
                      "/contact",
                      "/subprocessors",
                      "/login",
                    ],
                  },
                  eagerness: "conservative",
                },
              ],
            }),
          }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg">
          Skip to main content
        </a>
        <SessionProvider>
          <ThemeProvider>
            {children}
            <KeyboardShortcuts />
            <CookieConsent />
            <Toaster richColors position="bottom-right" />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
