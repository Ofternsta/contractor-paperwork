import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth"],
  images: {
    localPatterns: [{ pathname: "/logo.png" }, { pathname: "/logo-icon.png" }],
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
