import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, User } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { users } from '@/lib/mock-data';

// ---------------------------------------------------------------------------
// Mock helper – extract user id from mock token
// ---------------------------------------------------------------------------
function extractMockUserId(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;

  try {
    const payload = auth.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // ---------------------------------------------------------------------
    // Supabase Auth
    // ---------------------------------------------------------------------
    const supabase = await createServerSupabaseClient();

    if (supabase) {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '인증 토큰이 필요합니다.' },
          { status: 401 },
        );
      }

      // Fetch profile with department info
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      const user: User = profile ?? {
        id: authUser.id,
        email: authUser.email!,
        name: authUser.user_metadata?.name ?? authUser.email!.split('@')[0],
        department: authUser.user_metadata?.department ?? '',
        role: authUser.user_metadata?.role ?? 'user',
        avatar_url: null,
        created_at: authUser.created_at,
      };

      return NextResponse.json<ApiResponse<User>>({ success: true, data: user });
    }

    // ---------------------------------------------------------------------
    // Mock fallback
    // ---------------------------------------------------------------------
    const userId = extractMockUserId(request);

    if (!userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '인증 토큰이 필요합니다.' },
        { status: 401 },
      );
    }

    const user = users.find((u) => u.id === userId);

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse<User>>({ success: true, data: user });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '사용자 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
