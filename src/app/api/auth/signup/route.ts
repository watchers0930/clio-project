import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, LoginResponse } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, department_id } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '이메일, 비밀번호, 이름은 필수입니다.' },
        { status: 400 },
      );
    }

    // ---------------------------------------------------------------------
    // Supabase Auth
    // ---------------------------------------------------------------------
    const supabase = await createServerSupabaseClient();

    if (supabase) {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, department: department_id ?? '', role: 'user' },
        },
      });

      if (authError || !authData.user) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: authError?.message ?? '회원가입에 실패했습니다.' },
          { status: 400 },
        );
      }

      // Insert profile into users table
      const { error: insertError } = await supabase.from('users').insert({
        id: authData.user.id,
        email,
        name,
        department: department_id ?? '',
        role: 'user',
        avatar_url: null,
      } as never);

      if (insertError) {
        // Profile insert failed but auth user was created — log but don't block
        console.error('[signup] users insert error:', insertError.message);
      }

      const user = {
        id: authData.user.id,
        email,
        name,
        department: department_id ?? '',
        role: 'user' as const,
        avatar_url: null,
        created_at: authData.user.created_at,
      };

      return NextResponse.json<ApiResponse<LoginResponse>>({
        success: true,
        data: {
          token: authData.session?.access_token ?? '',
          user,
        },
      });
    }

    // ---------------------------------------------------------------------
    // Mock fallback (Supabase 미설정)
    // ---------------------------------------------------------------------
    const mockUser = {
      id: `user-${Date.now()}`,
      email,
      name,
      department: department_id ?? '',
      role: 'user' as const,
      avatar_url: null,
      created_at: new Date().toISOString(),
    };

    const mockToken = Buffer.from(
      JSON.stringify({ sub: mockUser.id, email: mockUser.email, role: mockUser.role, iat: Date.now() }),
    ).toString('base64url');

    return NextResponse.json<ApiResponse<LoginResponse>>({
      success: true,
      data: { token: `mock.${mockToken}.sig`, user: mockUser },
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '회원가입 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
