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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
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
          { key: "Cache-Control", value: "private, max-age=5, stale-while-revalidate=10" },
        ],
      },
      {
        source: "/api/health",
        headers: [
          { key: "Cache-Control", value: "public, max-age=30, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/api/status",
        headers: [
          { key: "Cache-Control", value: "public, max-age=30, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/api/analytics",
        headers: [
          { key: "Cache-Control", value: "private, max-age=60, stale-while-revalidate=120" },
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
  },
};
