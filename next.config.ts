import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth"],
  images: {
    localPatterns: [{ pathname: "/logo.png" }],
  },
};

export default nextConfig;
