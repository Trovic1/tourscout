import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The example plans are computed at build time, one after another (see app/api/examples).
  // Each is a full agent run, so the default 60s per page is too short.
  staticPageGenerationTimeout: 600,
  cacheComponents: true,
  partialPrefetching: true,
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
