import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "mammoth",
    "@napi-rs/canvas",
    "sharp",
  ],
  outputFileTracingIncludes: {
    "/api/upload": [
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-*/**/*",
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
    ],
  },
  images: {
    localPatterns: [
      { pathname: "/logo.png" },
      { pathname: "/logo-icon.png" },
      { pathname: "/how-to/**" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/icon.png?v=2",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
