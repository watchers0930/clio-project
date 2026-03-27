import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { getUserRoleInfo, isAdmin, isManagerOrAbove } from '@/lib/permissions';

/**
 * GET /api/departments — 부서 목록 (멤버 수 포함)
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const { data: depts, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    if (error) {
      console.error('[departments/GET]', error.message);
      return NextResponse.json({ success: false, error: '부서 목록 조회 실패' }, { status: 500 });
    }

    // 부서별 멤버 수 조회
    const { data: users } = await supabase.from('users').select('id, department_id, is_active');
    const memberCounts = new Map<string, number>();
    for (const u of (users ?? [])) {
      if (u.department_id && u.is_active !== false) {
        memberCounts.set(u.department_id, (memberCounts.get(u.department_id) ?? 0) + 1);
      }
    }

    const departments = (depts ?? []).map((d) => ({
      ...d,
      memberCount: memberCounts.get(d.id) ?? 0,
    }));

    return NextResponse.json({ success: true, data: departments });
  } catch {
    return NextResponse.json({ success: false, error: '부서 목록 조회 중 오류' }, { status: 500 });
  }
}

/**
 * POST /api/departments — 부서 생성 + 메신저 채널 자동 생성
 * admin만 가능
 */
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
    if (!name || !code) {
      return NextResponse.json({ success: false, error: '부서명과 코드는 필수입니다.' }, { status: 400 });
    }

    // 부서 생성
    const { data: dept, error: deptErr } = await supabase.from('departments').insert({
      name,
      code: code.toUpperCase(),
      description: description ?? null,
      manager_id: managerId ?? null,
    }).select().single();

    if (deptErr) {
      console.error('[departments/POST]', deptErr.message);
      return NextResponse.json({ success: false, error: '부서 생성 실패' }, { status: 500 });
    }

    // 메신저 채널 자동 생성
    const { data: channel } = await supabase.from('channels').insert({
      name,
      type: 'department',
      department_id: dept.id,
    }).select().single();

    // 부서장이 있으면 채널 멤버로 추가
    if (managerId && channel) {
      await supabase.from('channel_members').insert({
        channel_id: channel.id,
        user_id: managerId,
      }).catch(() => {});
    }

    // audit_logs
    await supabase.from('audit_logs').insert({
      user_id: authUserId,
      action: 'dept.create',
      target_type: 'department',
      target_id: dept.id,
      details: { name, code },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: { ...dept, memberCount: 0 } }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: '부서 생성 중 오류: ' + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

/**
 * PUT /api/departments — 부서 수정
 * admin 또는 해당 부서 manager
 */
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

    // 권한: admin 또는 해당 부서 manager
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

    const { data, error } = await supabase
      .from('departments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[departments/PUT]', error.message);
      return NextResponse.json({ success: false, error: '부서 수정 실패' }, { status: 500 });
    }

    // 채널 이름도 동기화
    if (name) {
      await supabase.from('channels')
        .update({ name })
        .eq('department_id', id)
        .eq('type', 'department')
        .catch(() => {});
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: '부서 수정 중 오류' }, { status: 500 });
  }
}

/**
 * DELETE /api/departments — 부서 비활성화
 * admin만 가능
 */
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

    // 비활성화 (소프트 삭제)
    const { error: delErr } = await supabase.from('departments').update({ is_active: false }).eq('id', id);
    if (delErr) {
      console.error('[departments/DELETE]', delErr.message);
      return NextResponse.json({ success: false, error: '부서 비활성화에 실패했습니다.' }, { status: 500 });
    }

    // audit_logs
    await supabase.from('audit_logs').insert({
      user_id: authUserId,
      action: 'dept.delete',
      target_type: 'department',
      target_id: id,
      details: {},
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: '부서 삭제 중 오류' }, { status: 500 });
  }
}
