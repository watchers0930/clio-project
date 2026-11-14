import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import type { DbUser } from '@/lib/supabase/types';
import { getUserRoleInfo, isAdmin, isManagerOrAbove } from '@/lib/permissions';
import { maskResidentNo } from '@/lib/format/personal';
import { isLockedDocumentError } from '@/lib/documents/locked-references';
import { countUserRetainedRecords, deactivationBlocker, syncAuthBanOrRevert } from '@/lib/users/user-activation';
import { requireAdmin } from '@/lib/http/admin-guard';
import { withMutation } from '@/lib/http/mutation-guard';

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

    const userRows = ((data ?? []) as Array<DbUser & { departments?: { id: string; name: string } | null }>);
    const users = userRows.map((u) => {
      const deptJoin = u.departments ?? null;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        department_id: u.department_id,
        departmentName: deptJoin?.name ?? '미배정',
        role: u.role,
        avatar_url: u.avatar_url,
        hire_date: (u as { hire_date?: string | null }).hire_date ?? null,
        phone: (u as { phone?: string | null }).phone ?? null,
        resident_no: (u as { resident_no?: string | null }).resident_no ?? null,
        address: (u as { address?: string | null }).address ?? null,
        position: (u as { position?: string | null }).position ?? null,
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
 * POST /api/users — 사용자 생성 (admin만)
 * body: { email, password, name, departmentId?, role? }
 */
export async function POST(request: NextRequest) {
  // 변이 요청: 인증 + 출처 + CSRF 토큰 + 활성 사용자 확인
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const supabase = mutation.supabase;
    const authUserId = mutation.userId;

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo || !isAdmin(roleInfo.role)) {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { email, password, name, departmentId, role, hireDate, phone, residentNo, address, position } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ success: false, error: '이메일, 비밀번호, 이름은 필수입니다.' }, { status: 400 });
    }

    // Service Role로 Auth 사용자 생성 (RLS bypass)
    const adminClient = createAdminSupabaseClient();

    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authErr || !authData.user) {
      return NextResponse.json({ success: false, error: authErr?.message ?? '계정 생성에 실패했습니다.' }, { status: 500 });
    }

    // users 테이블에 프로필 INSERT
    const baseProfile = {
      id: authData.user.id,
      email,
      name,
      department_id: departmentId ?? null,
      role: role ?? 'user',
      avatar_url: null,
    };
    // 확장 프로필 포함 시도 → 컬럼(마이그레이션 015/016) 미적용이면 기본 필드로 폴백
    const extProfile = {
      ...baseProfile,
      hire_date: hireDate || null,
      phone: phone || null,
      resident_no: residentNo ? maskResidentNo(residentNo) : null,
      address: address || null,
      position: position || null,
    };
    let { data: newUser, error: insertErr } = await adminClient
      .from('users')
      .insert(extProfile)
      .select()
      .single();
    if (insertErr && /hire_date|phone|resident_no|address|position|column/i.test(insertErr.message)) {
      ({ data: newUser, error: insertErr } = await adminClient.from('users').insert(baseProfile).select().single());
    }

    if (insertErr) {
      console.error('[users/POST] insert error:', insertErr.message);
      // Auth 계정도 롤백 (고아 방지)
      try { await adminClient.auth.admin.deleteUser(authData.user.id); } catch (e) { console.error("[users] auth rollback failed:", e); }
      return NextResponse.json({ success: false, error: '프로필 저장에 실패했습니다: ' + insertErr.message }, { status: 500 });
    }

    // 부서가 있으면 채널 멤버십 자동 추가
    if (departmentId) {
      const { data: channel } = await adminClient
        .from('channels')
        .select('id')
        .eq('department_id', departmentId)
        .eq('type', 'department')
        .single();

      if (channel) {
        try {
          await adminClient.from('channel_members').upsert(
            { channel_id: channel.id, user_id: authData.user.id },
            { onConflict: 'channel_id,user_id' }
          );
        } catch (e) { console.warn("[users] cleanup:", e); }
      }
    }

    // audit_logs
    try {
      await adminClient.from('audit_logs').insert({
        user_id: authUserId,
        action: 'user.create',
        target_type: 'user',
        target_id: authData.user.id,
        details: { email, name, role: role ?? 'user' },
      });
    } catch (e) { console.warn("[users] cleanup:", e); }

    return NextResponse.json({ success: true, data: newUser }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: '사용자 생성 중 오류: ' + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

/**
 * PUT /api/users — 사용자 수정 (부서 변경, 역할 변경, 비활성화)
 * admin: 모든 사용자, manager: 자기 부서 내에서만
 */
export async function PUT(request: NextRequest) {
  // 변이 요청: 인증 + 출처 + CSRF 토큰 + 활성 사용자 확인
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const supabase = mutation.supabase;
    const authUserId = mutation.userId;

    const myRole = await getUserRoleInfo(supabase, authUserId);
    if (!myRole || !isManagerOrAbove(myRole.role)) {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { id, departmentId, role, name, email, password, isActive, hireDate, phone, residentNo, address, position } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: '사용자 ID 필수' }, { status: 400 });

    // 대상 사용자 현재 정보
    const { data: target } = await supabase
      .from('users')
      .select('department_id, role, is_active')
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
      // 부서 이동은 관리자만 — 매니저가 자기·직원을 다른 부서(파일·채널)로 옮기는 우회 차단
      if (departmentId !== undefined && departmentId !== target.department_id) {
        return NextResponse.json({ success: false, error: '부서 변경은 관리자만 가능합니다.' }, { status: 403 });
      }
    } else if (id === authUserId && role !== undefined && role !== target.role) {
      // 관리자도 자기 역할은 바꿀 수 없다(service role 업데이트라 050 트리거 대신 여기서 막는다)
      return NextResponse.json({ success: false, error: '자기 자신의 역할은 변경할 수 없습니다.' }, { status: 400 });
    }

    // 활성 상태 변경: 활성 관리자만(requireAdmin), 자기 자신 비활성화 금지, 결재가 멈추는 비활성화 금지
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json({ success: false, error: '활성 상태 값이 올바르지 않습니다.' }, { status: 400 });
    }
    const activeChanged = isActive !== undefined && isActive !== (target.is_active !== false);
    if (activeChanged) {
      const guard = await requireAdmin(supabase, authUserId);
      if (guard) return guard;
      if (id === authUserId) return NextResponse.json({ success: false, error: '자기 자신의 활성 상태는 변경할 수 없습니다.' }, { status: 400 });
      if (!isActive) {
        const blocker = await deactivationBlocker(createAdminSupabaseClient(), id);
        if (blocker) return NextResponse.json({ success: false, error: blocker }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.is_active = isActive;
    if (hireDate !== undefined) updateData.hire_date = hireDate || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (residentNo !== undefined) updateData.resident_no = residentNo ? maskResidentNo(residentNo) : null;
    if (address !== undefined) updateData.address = address || null;
    if (position !== undefined) updateData.position = position || null;

    const oldDeptId = target.department_id;
    if (departmentId !== undefined) updateData.department_id = departmentId;

    // admin 수정은 service role(본인 포함) — 사용자 세션의 department_id 변경은 055 트리거가 거부하므로
    // 관리자의 부서 지정이 막히지 않게 한다. 비관리자(매니저 본인 수정 등)는 사용자 세션 + RLS·트리거를 그대로 따른다.
    const dbClient = isAdmin(myRole.role) ? createAdminSupabaseClient() : supabase;
    let { data, error } = await dbClient
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    // 확장 컬럼(마이그레이션 015/016) 미적용 시 해당 필드 제외하고 재시도
    if (error && /hire_date|phone|resident_no|address|position|column/i.test(error.message)) {
      const { hire_date: _h, phone: _p, resident_no: _r, address: _a, position: _pos, ...rest } = updateData;
      void _h; void _p; void _r; void _a; void _pos;
      ({ data, error } = await dbClient.from('users').update(rest).eq('id', id).select().single());
    }

    if (error) {
      console.error('[users/PUT]', error.message);
      return NextResponse.json({ success: false, error: '사용자 수정 실패' }, { status: 500 });
    }

    if (activeChanged && !(await syncAuthBanOrRevert(createAdminSupabaseClient(), id, isActive))) {
      return NextResponse.json({ success: false, error: '로그인 차단 상태 변경에 실패했습니다. 다시 시도해주세요.' }, { status: 500 });
    }

    // Auth 동기화 (비밀번호/이메일 변경 — admin만)
    if (isAdmin(myRole.role) && (password || email)) {
      const adminClient = createAdminSupabaseClient();
      const authUpdate: Record<string, string> = {};
      if (password) authUpdate.password = password;
      if (email) authUpdate.email = email;
      const { error: authErr } = await adminClient.auth.admin.updateUserById(id, authUpdate);
      if (authErr) {
        console.error('[users/PUT] auth update:', authErr.message);
        // Auth 실패해도 users 업데이트는 이미 반영됨 — 경고만
      }
    }

    // 부서 변경 시 채널 멤버십 이동 (adminClient로 RLS bypass)
    if (departmentId !== undefined && departmentId !== oldDeptId) {
      const admin = createAdminSupabaseClient();
      // 이전 부서 채널에서 제거
      if (oldDeptId) {
        const { data: oldChannel } = await admin
          .from('channels')
          .select('id')
          .eq('department_id', oldDeptId)
          .eq('type', 'department')
          .single();

        if (oldChannel) {
          await admin
            .from('channel_members')
            .delete()
            .eq('channel_id', oldChannel.id)
            .eq('user_id', id)
            ; // ignore error
        }
      }

      // 새 부서 채널에 추가
      if (departmentId) {
        const { data: newChannel } = await admin
          .from('channels')
          .select('id')
          .eq('department_id', departmentId)
          .eq('type', 'department')
          .single();

        if (newChannel) {
          await admin
            .from('channel_members')
            .upsert({ channel_id: newChannel.id, user_id: id }, { onConflict: 'channel_id,user_id' })
            ; // ignore error
        }
      }
    }

    // audit_logs
    try {
      await supabase.from('audit_logs').insert({
        user_id: authUserId,
        action: 'user.edit',
        target_type: 'user',
        target_id: id,
        details: { changes: updateData },
      });
    } catch (e) { console.warn("[users] cleanup:", e); }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: '사용자 수정 중 오류: ' + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

/**
 * DELETE /api/users — 사용자 비활성화/삭제
 * admin만 가능. query: ?id=xxx
 */
export async function DELETE(request: NextRequest) {
  // 변이 요청: 인증 + 출처 + CSRF 토큰 + 활성 사용자 확인
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const supabase = mutation.supabase;
    const authUserId = mutation.userId;

    const guard = await requireAdmin(supabase, authUserId); // 활성 관리자만(비활성 관리자의 잔여 토큰 차단)
    if (guard) return guard;

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: '사용자 ID 필수' }, { status: 400 });

    if (id === authUserId) {
      return NextResponse.json({ success: false, error: '자기 자신은 삭제할 수 없습니다.' }, { status: 400 });
    }

    // 결재·근태 기록이 있으면 영구 삭제 불가(CASCADE로 증적 소실) — 정리 작업보다 먼저 확인
    const adminClient = createAdminSupabaseClient();
    const retained = await countUserRetainedRecords(adminClient, id);
    if (retained > 0) {
      return NextResponse.json({ success: false, error: `결재·근태 기록(${retained}건)이 있는 사용자는 삭제할 수 없습니다. 비활성화를 사용해주세요.` }, { status: 409 });
    }

    // 채널 멤버십 제거
    // channel_members 쓰기는 service role 전용(055)
    try { await adminClient.from("channel_members").delete().eq("user_id", id); } catch (e) { console.warn("[users] channel cleanup failed:", e); }

    // users 테이블에서 완전 삭제
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) {
      if (isLockedDocumentError(error)) {
        return NextResponse.json({ success: false, error: '결재 기록이 있는 사용자는 삭제할 수 없습니다. 비활성화를 사용해주세요.' }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: '사용자 삭제 실패: ' + error.message }, { status: 500 });
    }

    // Supabase Auth에서도 삭제
    try { await adminClient.auth.admin.deleteUser(id); } catch (e) { console.error("[users] auth delete failed:", e); }

    try {
      await supabase.from('audit_logs').insert({
        user_id: authUserId,
        action: 'user.delete',
        target_type: 'user',
        target_id: id,
        details: {},
      });
    } catch (e) { console.warn("[users] cleanup:", e); }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: '사용자 삭제 중 오류' }, { status: 500 });
  }
}
