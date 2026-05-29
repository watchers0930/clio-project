import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/*': ['./node_modules/pdfjs-dist/**/*'],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
