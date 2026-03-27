import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { getUserRoleInfo, isAdmin, isManagerOrAbove } from '@/lib/permissions';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const { data: depts, error } = await supabase.from('departments').select('*').order('name');
    if (error) return NextResponse.json({ success: false, error: '부서 목록 조회 실패' }, { status: 500 });

    const { data: users } = await supabase.from('users').select('id, department_id, is_active');
    const memberCounts = new Map<string, number>();
    for (const u of (users ?? [])) {
      if (u.department_id && u.is_active !== false) {
        memberCounts.set(u.department_id, (memberCounts.get(u.department_id) ?? 0) + 1);
      }
    }

    const departments = (depts ?? []).map((d) => ({ ...d, memberCount: memberCounts.get(d.id) ?? 0 }));
    return NextResponse.json({ success: true, data: departments });
  } catch {
    return NextResponse.json({ success: false, error: '부서 목록 조회 중 오류' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo || !isAdmin(roleInfo.role)) {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { name, code, description, managerId } = await request.json();
    if (!name || !code) return NextResponse.json({ success: false, error: '부서명과 코드는 필수입니다.' }, { status: 400 });

    const { data: dept, error: deptErr } = await supabase.from('departments').insert({
      name, code: code.toUpperCase(), description: description ?? null, manager_id: managerId ?? null,
    }).select().single();

    if (deptErr) return NextResponse.json({ success: false, error: '부서 생성 실패: ' + deptErr.message }, { status: 500 });

    const { data: channel } = await supabase.from('channels').insert({
      name, type: 'department', department_id: dept.id,
    }).select().single();

    if (managerId && channel) {
      try { await supabase.from('channel_members').insert({ channel_id: channel.id, user_id: managerId }); } catch {}
    }

    try { await supabase.from('audit_logs').insert({ user_id: authUserId, action: 'dept.create', target_type: 'department', target_id: dept.id, details: { name, code } }); } catch {}

    return NextResponse.json({ success: true, data: { ...dept, memberCount: 0 } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: '부서 생성 중 오류: ' + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) return NextResponse.json({ success: false, error: '사용자 정보 없음' }, { status: 403 });

    const { id, name, code, description, managerId, isActive } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'ID 필수' }, { status: 400 });

    if (!isAdmin(roleInfo.role)) {
      if (!isManagerOrAbove(roleInfo.role) || roleInfo.department_id !== id) {
        return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code.toUpperCase();
    if (description !== undefined) updateData.description = description;
    if (managerId !== undefined) updateData.manager_id = managerId;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { data, error } = await supabase.from('departments').update(updateData).eq('id', id).select().single();
    if (error) return NextResponse.json({ success: false, error: '부서 수정 실패: ' + error.message }, { status: 500 });

    if (name) {
      try { await supabase.from('channels').update({ name }).eq('department_id', id).eq('type', 'department'); } catch {}
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: '부서 수정 중 오류: ' + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo || !isAdmin(roleInfo.role)) {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID 필수' }, { status: 400 });

    // 부서에 직원이 있는지 확인
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', id);

    if ((count ?? 0) > 0) {
      return NextResponse.json({ success: false, error: `부서에 직원이 ${count}명 있어서 삭제할 수 없습니다. 먼저 직원을 다른 부서로 이동하세요.` }, { status: 400 });
    }

    // 연결된 채널 삭제
    try { await supabase.from('channels').delete().eq('department_id', id).eq('type', 'department'); } catch {}

    // 부서 완전 삭제
    const { error: delErr } = await supabase.from('departments').delete().eq('id', id);
    if (delErr) return NextResponse.json({ success: false, error: '부서 삭제 실패: ' + delErr.message }, { status: 500 });

    try { await supabase.from('audit_logs').insert({ user_id: authUserId, action: 'dept.delete', target_type: 'department', target_id: id, details: {} }); } catch {}

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: '부서 삭제 중 오류' }, { status: 500 });
  }
}
