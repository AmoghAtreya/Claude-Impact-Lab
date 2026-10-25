import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Uses WebAssembly that shouldn't go through the server bundler.
  serverExternalPackages: ["heic-convert"],
  experimental: {
    serverActions: {
      // Onboarding accepts a profile picture up to 5 MB, plus multipart
      // overhead and the other form fields.
      bodySizeLimit: "6mb",
    },
  },
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
