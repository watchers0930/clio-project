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
-- 되돌리기: drop trigger documents_sync_input_values on public.documents;
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

commit;
