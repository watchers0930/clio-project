-- 059: 문서 양식 입력값을 본문 앞 주석에서 별도 칸(documents.input_values)으로 분리 — 1단계
--
-- 문제(2026-11-17 운영 실측): 문서 20건 전부 본문 맨 앞에 입력값 JSON 주석(<!--DOCUMENT_INPUTS:{...}-->, 평균 1,134자)이 있다.
--   본문을 쓰는 곳마다 걷어내기를 기억해야 해서 공유 링크·문서 상세·생성 결과·AI 프롬프트·검색 미리보기 등에 원문 JSON 이 노출됐고,
--   코멘트 반영(GPT 가 본문을 다시 씀)에서 주석이 빠지면 입력값이 사라져 다운로드·입력값 편집이 깨질 수 있었다.
--
-- 1단계(이 마이그레이션):
--   1) input_values jsonb 칸 추가, 기존 문서의 주석 값을 복사(본문은 건드리지 않음 — 옛 코드로 되돌려도 동작).
--   2) 본문 저장 시 트리거가 주석 → 칸을 동기화. 모든 저장 경로(생성·휴가원·편집·코멘트 반영·회의록)를 한곳에서 처리한다.
--      본문에 주석이 없으면(GPT 가 뺀 경우 등) 기존 칸 값을 그대로 둔다 → 입력값 유실 방지.
-- 2단계(운영 확인 후 별도): 저장 경로가 주석을 더 쓰지 않고 칸에만 쓰게 바꾸고, 기존 본문에서 주석 제거.
--
-- 되돌리기(🔴 반드시 코드를 v7.97.x 로 먼저 되돌린 뒤 — 새 코드는 input_values 칸을 조회하므로 칸을 먼저 지우면 다운로드 전체가 404):
--           alter table public.documents drop constraint documents_input_values_object;
--           leave_document_lock 은 047 정의로 재생성(input_values 비교 줄 제거);
--           drop trigger documents_sync_input_values on public.documents;
--           drop function public.documents_sync_input_values(); drop function public.parse_document_inputs(text);
--           alter table public.documents drop column input_values;
begin;

alter table public.documents add column if not exists input_values jsonb;

-- 본문 첫 줄의 입력값 주석을 jsonb 로 — 문자열 값만 가진 객체일 때만, 아니면 null(앱의 isStringRecord 와 같은 기준)
create or replace function public.parse_document_inputs(content text)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  raw text;
  j jsonb;
begin
  if content is null or content !~ '^<!--(DOCUMENT_INPUTS|PROPOSAL_INPUTS):' then
    return null;
  end if;
  -- 첫 줄의 마지막 --> 까지(값 안의 이스케이프 안 된 --> 에도 끊기지 않게)
  raw := substring(split_part(content, chr(10), 1) from '^<!--(?:DOCUMENT_INPUTS|PROPOSAL_INPUTS):(.*)-->' || chr(13) || '?$');
  if raw is null then
    return null;
  end if;
  begin
    j := raw::jsonb;
  exception when others then
    return null;
  end;
  if jsonb_typeof(j) <> 'object' or exists (select 1 from jsonb_each(j) e where jsonb_typeof(e.value) <> 'string') then
    return null;
  end if;
  return j;
end;
$$;

create or replace function public.documents_sync_input_values()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parsed jsonb := public.parse_document_inputs(new.content);
begin
  -- 본문에 유효한 주석이 있으면 그 값이 기준, 없으면 칸 값을 그대로 둔다(갱신 시엔 기존 값 유지)
  if parsed is not null then
    new.input_values := parsed;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_sync_input_values on public.documents;
create trigger documents_sync_input_values
  before insert or update of content on public.documents
  for each row execute function public.documents_sync_input_values();

-- 기존 문서 채우기(본문은 그대로)
update public.documents
set input_values = public.parse_document_inputs(content)
where input_values is null and public.parse_document_inputs(content) is not null;

-- 칸에는 객체(또는 null)만 — 배열·문자열 같은 값이 직접 들어가지 않게
alter table public.documents add constraint documents_input_values_object
  check (input_values is null or jsonb_typeof(input_values) = 'object');

-- 휴가원 잠금(047)에 input_values 추가 — 다운로드·미리보기가 칸을 먼저 읽으므로, 잠긴 휴가원의 칸만 직접 바꾸는 것도 막는다.
-- (위 채우기 다음에 둬야 한다 — 먼저 두면 잠긴 휴가원 채우기가 이 잠금에 걸린다)
create or replace function public.leave_document_lock()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if exists(select 1 from leave_requests where document_id = old.id and status in ('pending','approved','rejected'))
     and (new.content is distinct from old.content
       or new.input_values is distinct from old.input_values
       or new.template_id is distinct from old.template_id
       or new.created_by is distinct from old.created_by
       or new.title is distinct from old.title) then
    raise exception 'leave document locked';
  end if;
  return new;
end;
$function$;

-- parse_document_inputs 실행 권한은 그대로 둔다: 동기화 트리거가 저장하는 사용자 권한으로 이 함수를 부르므로
-- authenticated 에서 회수하면 일반 문서 저장이 권한 오류로 실패한다(데이터를 읽지 않는 순수 함수라 노출 위험 없음).

commit;
