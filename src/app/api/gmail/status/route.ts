import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

// GET /api/gmail/status — 현재 사용자의 Gmail 연결 상태 조회
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { data } = await supabase
    .from('user_google_connections')
    .select('email, last_synced_at, sync_enabled, created_at')
    .eq('user_id', userId)
    .single();

  if (!data) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    email: data.email,
    lastSyncedAt: data.last_synced_at,
    syncEnabled: data.sync_enabled,
    connectedAt: data.created_at,
  });
}
