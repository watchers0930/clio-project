import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { buildApprovalLine, type OrgMember } from '@/lib/approval/build-line';

export const maxDuration = 20;
const DEFAULT_DEPTH = 2;

// GET /api/approvals/preview?documentId= — 상신 전 결재선 미리보기(저장하지 않음)
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

  const documentId = request.nextUrl.searchParams.get('documentId') ?? '';
  if (!documentId) return NextResponse.json({ success: false, error: '문서 id가 필요합니다.' }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data: doc } = await admin
    .from('documents')
    .select('id, title, template_id, created_by')
    .eq('id', documentId)
    .maybeSingle();
  if (!doc) return NextResponse.json({ success: false, error: '문서를 찾을 수 없습니다.' }, { status: 404 });

  // 결재선은 문서 작성자 기준으로 생성된다.
  const requesterId = doc.created_by ?? authUserId;

  let depth = DEFAULT_DEPTH;
  if (doc.template_id) {
    const { data: tmpl } = await admin.from('templates').select('approval_depth').eq('id', doc.template_id).maybeSingle();
    const d = (tmpl?.approval_depth ?? null) as number | null;
    if (d && d >= 1) depth = d;
  }
  if (/품의서|휴가원/.test(doc.title ?? '')) depth = 3;

  const { data: members } = await admin
    .from('users')
    .select('id, name, email, manager_user_id, rank_level, rank_title');
  const byId = new Map<string, OrgMember>((members ?? []).map((m: OrgMember) => [m.id, m]));

  const line = buildApprovalLine(requesterId, byId, depth);
  return NextResponse.json({
    success: true,
    depth,
    line,
    complete: line.length >= 2,
  });
}
