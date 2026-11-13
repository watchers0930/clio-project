-- 053: 계정 활성 상태(is_active) 자기 변경 차단 — 050 확장
--
-- 배경: 050 트리거가 role/rank_level 만 막아, users_update_own 정책으로 사용자 세션이
-- Supabase REST `PATCH /rest/v1/users {is_active:true}` 를 호출하면 비활성화된 본인 계정을 스스로 되살릴 수 있었다.
-- (2026-11-13 운영 확인: 출처 불명으로 admin@clio.kr 이 비활성 상태였음 — 감사로그 없음, 복구 완료)
--
-- 조치: 같은 트리거 함수에 is_active 를 추가한다.
-- - 활성/비활성 전환은 관리자 API(users PUT, service_role)만 한다 → auth.uid() null 로 통과.
-- - 사용자 세션의 INSERT(가입)는 기본값 true 만 허용, UPDATE 는 is_active 변경을 거부.
-- 앱 쪽: src/lib/users/user-activation.ts (비활성화 시 Auth 차단 동기화)

create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      if new.role is distinct from 'user' or new.rank_level is not null then
        raise exception '가입 시 권한(role/rank_level)을 지정할 수 없습니다.';
      end if;
      if new.is_active is distinct from true then
        raise exception '가입 시 활성 상태를 지정할 수 없습니다.';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.role is distinct from old.role or new.rank_level is distinct from old.rank_level then
        raise exception '권한(role/rank_level)은 직접 변경할 수 없습니다.';
      end if;
      if new.is_active is distinct from old.is_active then
        raise exception '계정 활성 상태는 관리자만 변경할 수 있습니다.';
      end if;
    end if;
  end if;
  return new;
end;
$$;
