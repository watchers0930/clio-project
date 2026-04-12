import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: '유효하지 않은 ID입니다.' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const userId = await getAuthUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('contract_risk_analyses')
    .select('id, user_id, file_name, file_type, contract_type, perspective, risk_result, risk_count, status, created_at, updated_at')
    .eq('id', id)
    .single() as { data: Record<string, unknown> | null; error: unknown };

  if (error || !data) {
    return NextResponse.json({ error: 'NOT_FOUND', message: '분석 결과를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (data.user_id !== userId) {
    return NextResponse.json({ error: 'NOT_FOUND', message: '분석 결과를 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: '유효하지 않은 ID입니다.' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const userId = await getAuthUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from('contract_risk_analyses')
    .select('user_id')
    .eq('id', id)
    .single() as { data: { user_id: string } | null };

  if (!existing || existing.user_id !== userId) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('contract_risk_analyses')
    .delete()
    .eq('id', id);

  return NextResponse.json({ success: true });
}
