import type { NextConfig } from "next";

// chromium(puppeteer) 또는 pdfjs-dist를 (직접/간접) 동적 import로 사용하는 라우트 목록.
// 동적 import는 Next 자동 트레이싱이 못 잡으므로 여기에 명시해야 런타임에 파일이 포함된다.
// ⚠️ 이 목록에서 누락된 라우트가 chromium/pdfjs를 호출하면 런타임 에러 → import 기준으로 전수 수집(과포함 허용).
// 기존 '/api/*' 와일드카드는 로그인·조회 등 경량 라우트까지 수백 MB를 번들링해 콜드스타트를 수초로 만들었다.
const HEAVY_DEPS = [
  './node_modules/@sparticuz/chromium/**/*',
  './node_modules/puppeteer-core/**/*',
  './node_modules/pdfjs-dist/**/*',
];
const HEAVY_ROUTES = [
  // chromium(htmlToPdf) 경로: 문서 생성/다운로드 PDF
  '/api/documents/[id]/download',
  '/api/documents',
  '/api/documents/[id]',
  '/api/documents/[id]/ai-context',
  '/api/generate',
  '/api/memos/proposal-report',
  '/api/transcribe',
  // pdfjs(extractText) 경로: 파일 텍스트 추출·분석
  '/api/local-files/process',
  '/api/contract-risk/analyze',
  '/api/contract-risk/[id]/apply',
  '/api/files/[id]/preview',
  '/api/files/process',
  '/api/templates/analyze',
  '/api/bulk-transfer/extract',
  '/api/gmail/sync',
  '/api/cron/gmail-sync',
  '/api/autofill/analyze',
  '/api/autofill/generate',
  '/api/search',
  '/api/chat',
  '/api/settings/company-logo',
  '/api/settings/company-seal',
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist', '@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: Object.fromEntries(HEAVY_ROUTES.map((r) => [r, HEAVY_DEPS])),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
