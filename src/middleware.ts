// =============================================================================
// CLIO - Next.js 미들웨어
// Supabase Auth 세션 갱신 + 미인증 사용자 /login 리다이렉트
// =============================================================================

import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// 인증 없이 접근 가능한 경로
const PUBLIC_PATHS = ['/login', '/signup', '/auth/callback'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일, API 라우트, 공개 경로는 건너뛰기
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // 개발 환경에서는 인증 건너뛰기
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // Supabase 세션 갱신 시도
  const result = await updateSession(request);

  // Supabase 미설정 시 mock 모드 — 모든 접근 허용
  if (!result) {
    return NextResponse.next();
  }

  const { user, response } = result;

  // 미인증 사용자 → /login 리다이렉트
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // _next/static, _next/image, favicon 등 제외
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
