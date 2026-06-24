import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist', 'pdf-parse', '@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/*': [
      './node_modules/pdfjs-dist/**/*',
      './node_modules/pdf-parse/**/*',
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
