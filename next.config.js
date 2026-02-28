/** @type {import('next').NextConfig} */
module.exports = {
  generateBuildId: async () => {
    return process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString();
  },
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
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
        ],
      },
    ];
  },

  webpack: (config) => {
    // pdfjs-dist tries to require 'canvas' for Node.js rendering — we only need text extraction
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
