import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist', '@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/*': ['./node_modules/pdfjs-dist/**/*', './node_modules/@sparticuz/chromium/**/*'],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
