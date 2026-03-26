import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, LoginResponse } from '@/lib/supabase/types';
import { users } from '@/lib/mock-data';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 },
      );
    }

    // Mock authentication — accept any password for known emails
    const user = users.find((u) => u.email === email);

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '등록되지 않은 이메일입니다.' },
        { status: 401 },
      );
    }

    // Generate a mock JWT-like token (not cryptographically secure — dev only)
    const mockToken = Buffer.from(
      JSON.stringify({ sub: user.id, email: user.email, role: user.role, iat: Date.now() }),
    ).toString('base64url');

    return NextResponse.json<ApiResponse<LoginResponse>>({
      success: true,
      data: { token: `mock.${mockToken}.sig`, user },
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
