/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
    serverActions: {
      allowedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL
          ? process.env.NEXT_PUBLIC_APP_URL.replace("https://", "").replace("http://", "")
          : "localhost:3000",
      ],
    },
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-tabs",
      "@radix-ui/react-switch",
      "@radix-ui/react-label",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-separator",
      "@radix-ui/react-progress",
      "date-fns",
      "recharts",
      "swr",
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires unsafe-inline for styles; unsafe-eval only in dev
              "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.googleusercontent.com https://*.githubusercontent.com",
              "font-src 'self'",
              "connect-src 'self' https://api.groq.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/api/applications/send-stats",
        headers: [
          { key: "Cache-Control", value: "private, max-age=5, stale-while-revalidate=10, stale-if-error=60" },
        ],
      },
      {
        source: "/api/health",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=30, stale-while-revalidate=60, stale-if-error=300" },
        ],
      },
      {
        source: "/api/status",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=30, stale-while-revalidate=60, stale-if-error=300" },
        ],
      },
      {
        source: "/api/analytics",
        headers: [
          { key: "Cache-Control", value: "private, s-maxage=60, stale-while-revalidate=120, stale-if-error=3600" },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, s-maxage=30, stale-while-revalidate=60, stale-if-error=3600" },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.githubusercontent.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },
};
