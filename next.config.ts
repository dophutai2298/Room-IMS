import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/rooms/*/invoices/pdf": [
      "./node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
      "./node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf",
    ],
  },
};

export default nextConfig;
