import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ALLOWED_MENUS = ['shared-documents', 'messages', 'meetings', 'schedule', 'memos', 'contract-risk'];

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const menus: string[] = Array.isArray(body.menus) ? body.menus : [];
    const validated = menus.filter((m) => ALLOWED_MENUS.includes(m));

    const { error } = await supabase
      .from('users')
      .update({ sidebar_menus: validated })
      .eq('id', authUser.id);

    if (error) {
      return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<{ menus: string[] }>>({ success: true, data: { menus: validated } });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
