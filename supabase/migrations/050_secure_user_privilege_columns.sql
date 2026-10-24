-- 050: 권한 상승(self privilege escalation) 차단 — 운영 적용 완료(2026-10-23)
--
-- 배경: users_update_own 정책이 `with check (auth.uid() = id)`만 있고 컬럼 제한이 없으며,
-- authenticated 역할이 users 테이블 전체 UPDATE 권한을 가져 컬럼 단위 REVOKE가 무효였다.
-- → 일반 사용자가 Supabase REST로 `PATCH /rest/v1/users {role:"admin"}` 를 호출해
--   자기 role/rank_level 을 바꾸면 모든 API 권한 가드가 무력화된다.
--
-- 조치: BEFORE UPDATE 트리거로 role/rank_level 직접 변경을 차단한다.
-- - service_role(서버 admin 클라이언트)은 JWT가 없어 auth.uid()가 null → 통과한다.
--   (조직도 저장 org-chart PUT, 역할 변경 users PUT 등은 모두 service_role이므로 영향 없음)
-- - 사용자 세션(authenticated)이 role/rank_level 을 바꾸려 하면 예외로 거부된다.
-- - 프로필 컬럼(name/signature_path/sidebar_menus 등)과 role/rank 외 변경은 정상 동작한다.
--
-- 검증(운영, 트랜잭션 롤백): 사원 세션 role 변경 → 예외 / 서버 경로 rank_level 변경 → 성공. 확인 완료.
--
-- 후속 과제(별도): transfer_*/account_credentials/templates 테이블 RLS 역할 강화,
--   users INSERT 경로(신규 가입 role 지정), 템플릿 미리보기 XSS, 계정관리 진입비번 서버 강제.

-- INSERT도 포함: 사용자 세션이 role='admin'/rank_level을 지정한 신규 삽입(REST 직접 가입)을 차단.
-- 정상 signup(role='user', rank_level=null)과 service_role(auth.uid null)은 통과한다.
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
    elsif tg_op = 'UPDATE' then
      if new.role is distinct from old.role or new.rank_level is distinct from old.rank_level then
        raise exception '권한(role/rank_level)은 직접 변경할 수 없습니다.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_privilege_escalation on public.users;
create trigger trg_prevent_self_privilege_escalation
  before insert or update on public.users
  for each row execute function public.prevent_self_privilege_escalation();
