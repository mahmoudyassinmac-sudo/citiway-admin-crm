import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stamp / signature uploads go through a server action.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
