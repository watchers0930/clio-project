import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { getUserRoleInfo, isAdmin, isManagerOrAbove } from '@/lib/permissions';

/**
 * GET /api/users — 사용자 목록
 * 모든 인증된 사용자 접근 가능, 부서별/역할별 필터 지원
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');
    const role = searchParams.get('role');

    let query = supabase
      .from('users')
      .select('*, departments:department_id(id, name)')
      .order('name');

    if (departmentId) query = query.eq('department_id', departmentId);
    if (role) query = query.eq('role', role);

    const { data, error } = await query;
    if (error) {
      console.error('[users/GET]', error.message);
      return NextResponse.json({ success: false, error: '사용자 목록 조회 실패' }, { status: 500 });
    }

    const users = (data ?? []).map((u) => {
      const deptJoin = (u as Record<string, unknown>).departments as { id: string; name: string } | null;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        department_id: u.department_id,
        departmentName: deptJoin?.name ?? '미배정',
        role: u.role,
        avatar_url: u.avatar_url,
        is_active: u.is_active ?? true,
        created_at: u.created_at,
      };
    });

    return NextResponse.json({ success: true, data: users });
  } catch {
    return NextResponse.json({ success: false, error: '사용자 목록 조회 중 오류' }, { status: 500 });
  }
}

/**
 * PUT /api/users — 사용자 수정 (부서 변경, 역할 변경, 비활성화)
 * admin: 모든 사용자, manager: 자기 부서 내에서만
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const myRole = await getUserRoleInfo(supabase, authUserId);
    if (!myRole || !isManagerOrAbove(myRole.role)) {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { id, departmentId, role, name, isActive } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: '사용자 ID 필수' }, { status: 400 });

    // 대상 사용자 현재 정보
    const { data: target } = await supabase
      .from('users')
      .select('department_id, role')
      .eq('id', id)
      .single();

    if (!target) return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 });

    // manager 권한 체크: 자기 부서 내에서만, 역할 변경 불가
    if (!isAdmin(myRole.role)) {
      if (target.department_id !== myRole.department_id) {
        return NextResponse.json({ success: false, error: '다른 부서 사용자를 수정할 수 없습니다.' }, { status: 403 });
      }
      if (role !== undefined) {
        return NextResponse.json({ success: false, error: '역할 변경은 관리자만 가능합니다.' }, { status: 403 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.is_active = isActive;

    const oldDeptId = target.department_id;
    if (departmentId !== undefined) updateData.department_id = departmentId;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[users/PUT]', error.message);
      return NextResponse.json({ success: false, error: '사용자 수정 실패' }, { status: 500 });
    }

    // 부서 변경 시 채널 멤버십 이동
    if (departmentId !== undefined && departmentId !== oldDeptId) {
      // 이전 부서 채널에서 제거
      if (oldDeptId) {
        const { data: oldChannel } = await supabase
          .from('channels')
          .select('id')
          .eq('department_id', oldDeptId)
          .eq('type', 'department')
          .single();

        if (oldChannel) {
          await supabase
            .from('channel_members')
            .delete()
            .eq('channel_id', oldChannel.id)
            .eq('user_id', id)
            .catch(() => {});
        }
      }

      // 새 부서 채널에 추가
      if (departmentId) {
        const { data: newChannel } = await supabase
          .from('channels')
          .select('id')
          .eq('department_id', departmentId)
          .eq('type', 'department')
          .single();

        if (newChannel) {
          await supabase
            .from('channel_members')
            .upsert({ channel_id: newChannel.id, user_id: id }, { onConflict: 'channel_id,user_id' })
            .catch(() => {});
        }
      }
    }

    // audit_logs
    await supabase.from('audit_logs').insert({
      user_id: authUserId,
      action: 'user.edit',
      target_type: 'user',
      target_id: id,
      details: { changes: updateData },
    }).catch(() => {});

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: '사용자 수정 중 오류' }, { status: 500 });
  }
}
