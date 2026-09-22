import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { RULE_MIN_LEN, RULE_MAX_LEN } from '@/lib/google/gmail-auto-delete';

export const maxDuration = 30;

// 한 사용자가 등록할 수 있는 자동삭제 규칙 최대 개수. 무분별한 대량 등록 방지.
const MAX_RULES_PER_USER = 50;

// GET /api/gmail/auto-delete-rules — 본인 자동삭제 규칙 목록
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // RLS로 본인 것만 반환된다.
  const { data, error } = await supabase
    .from('gmail_auto_delete_rules')
    .select('id, pattern, enabled, last_run_at, total_trashed, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: '규칙을 불러오지 못했습니다.' }, { status: 500 });
  return NextResponse.json({ success: true, rules: data ?? [] });
}

// POST /api/gmail/auto-delete-rules — 자동삭제 규칙 등록
// body { pattern: string } — Gmail 검색식 조각 (예: from:noreply@x.com, 광고)
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  let pattern = '';
  try {
    const body = await request.json();
    pattern = typeof body?.pattern === 'string' ? body.pattern.trim() : '';
  } catch { /* body 없음 */ }

  // 서버 검증: 너무 짧으면 사실상 전체 매칭 위험, 너무 길면 오·남용.
  if (pattern.length < RULE_MIN_LEN) {
    return NextResponse.json({ error: `규칙은 ${RULE_MIN_LEN}자 이상 입력해 주세요.` }, { status: 400 });
  }
  if (pattern.length > RULE_MAX_LEN) {
    return NextResponse.json({ error: '규칙이 너무 깁니다.' }, { status: 400 });
  }

  // 규칙 개수 상한 확인
  const { count } = await supabase
    .from('gmail_auto_delete_rules')
    .select('id', { count: 'exact', head: true });
  if ((count ?? 0) >= MAX_RULES_PER_USER) {
    return NextResponse.json(
      { error: `자동삭제 규칙은 최대 ${MAX_RULES_PER_USER}개까지 등록할 수 있습니다.` },
      { status: 400 },
    );
  }

  // RLS + WITH CHECK로 본인 것만 삽입 가능. 중복(user_id, pattern)은 UNIQUE로 차단.
  const { data, error } = await supabase
    .from('gmail_auto_delete_rules')
    .insert({ user_id: userId, pattern })
    .select('id, pattern, enabled, last_run_at, total_trashed, created_at')
    .single();

  if (error) {
    // 23505 = unique_violation (이미 등록된 규칙)
    if (error.code === '23505') {
      return NextResponse.json({ error: '이미 등록된 규칙입니다.', code: 'duplicate' }, { status: 409 });
    }
    return NextResponse.json({ error: '규칙 등록에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, rule: data });
}

// DELETE /api/gmail/auto-delete-rules?id=<uuid> — 자동삭제 규칙 해제
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: '삭제할 규칙 id가 필요합니다.' }, { status: 400 });

  // RLS로 본인 규칙만 삭제된다(타인 id를 넣어도 매칭 0건).
  const { error } = await supabase
    .from('gmail_auto_delete_rules')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: '규칙 삭제에 실패했습니다.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
