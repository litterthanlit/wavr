import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@wavr/gradient", "@wavr/preview", "@wavr/core"],
};

export default nextConfig;
