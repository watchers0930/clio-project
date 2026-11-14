-- 055: 접근 권한을 "부여"하는 테이블의 사용자 세션 쓰기 차단 — 서버(service role) 전용
--
-- 배경(2026-11-14 운영 롤백 시험으로 실증):
--   channel_members_insert(user_id = auth.uid()) → 아무 채널에나 자기가입 후 남의 대화 열람(가입 전 0건 → 후 4건)
--   fp_insert(true)·fp_delete(true)          → 남의 파일 권한을 자기에게 부여(canAccessFile 이 신뢰) / 남의 권한 삭제
--   file_shares_insert(shared_by = auth.uid()) → 남의 파일을 자기에게 공유(파일 상세 조회가 신뢰)
--   channels_insert(true)·messages_insert(sender_id = auth.uid()) → 서버를 거치지 않는 채널 생성·아무 채널 메시지 작성
--
-- 조치: 위 INSERT/DELETE 정책을 제거한다(RLS 는 켜진 채라 사용자 세션 쓰기는 거부되고 service role 만 쓴다).
--   앱의 쓰기는 모두 서버 API 가 권한 확인 후 service role 로 한다(v7.96.0: 채널 가입 확인·파일 공유 권한 INSERT 이전).
-- 유지: SELECT 정책(실시간 구독은 messages_select 사용), 본인 멤버십 삭제(채널 나가기), 본인 공유 삭제.

-- 사용자 세션의 자기 부서(department_id) 변경 차단 — 부서가 파일·채널 접근의 기준이라
-- users_update_own 으로 자기 부서를 바꿔 다른 부서 자료에 접근할 수 있었다(롤백 시험으로 실증).
-- 053 함수에 department_id 를 더한다. 관리자의 부서 지정은 서버(service role, users PUT)가 한다.
-- 가입(INSERT) 시 부서 선택은 기존 그대로 둔다(가입 화면 설계 사항).
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
      if new.department_id is distinct from old.department_id then
        raise exception '부서는 관리자만 변경할 수 있습니다.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists "channel_members_insert" on public.channel_members;
drop policy if exists "channels_insert" on public.channels;
drop policy if exists "messages_insert" on public.messages;
drop policy if exists "fp_insert" on public.file_permissions;
drop policy if exists "fp_delete" on public.file_permissions;
drop policy if exists "file_shares_insert" on public.file_shares;
