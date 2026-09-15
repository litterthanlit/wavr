import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@wavr/gradient", "@wavr/preview", "@wavr/core"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
