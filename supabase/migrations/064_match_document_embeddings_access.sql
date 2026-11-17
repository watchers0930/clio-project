-- 064: 문서 벡터 검색(match_document_embeddings)에 권한 조건 인자 추가 — 권한 필터를 LIMIT 전에
--
-- 문제(2026-11-17 리뷰): 검색 API 가 서버 권한으로 전사 상위 15건을 받은 뒤 앱에서 권한을 걸렀다.
--   볼 수 없는 문서가 상위를 차지하면 그만큼 볼 수 있는 문서가 결과에서 빠진다(문서가 늘수록 심해짐).
-- 변경: filter_owner(작성자)·filter_document_ids(공유받은 문서) 를 받아 그 안에서만 고른다. 둘 다 null 이면 전체(관리자).
--   앱 규칙(lib/permissions getAccessibleDocumentIds: 관리자 / 본인 작성 / 공유)과 같은 기준을 검색 API 가 인자로 넘긴다.
-- 실행 권한: 검색 API 의 서버 권한(service_role) 호출만 쓰므로 그 외에는 회수한다
--   (document_embeddings 는 061 로 이미 서버 전용 — 직원이 불러도 0건이었지만, 인자로 남의 범위를 묻는 통로를 남기지 않는다).
--
-- 되돌리기: drop function public.match_document_embeddings(vector, integer, double precision, uuid, uuid[]);
--           022 의 3인자 정의를 다시 만든다(앱도 v7.98.5 로 되돌린 뒤).
begin;

drop function if exists public.match_document_embeddings(vector, integer, double precision);

create or replace function public.match_document_embeddings(
  query_embedding     vector(1536),
  match_count         int default 10,
  match_threshold     float default 0.3,
  filter_owner        uuid default null,
  filter_document_ids uuid[] default null
)
returns table (document_id uuid, similarity float)
language sql
stable
set search_path = public, extensions
as $$
  select de.document_id, 1 - (de.embedding <=> query_embedding) as similarity
  from document_embeddings de
  where 1 - (de.embedding <=> query_embedding) >= match_threshold
    and (
      (filter_owner is null and filter_document_ids is null)
      or exists (select 1 from documents d where d.id = de.document_id and d.created_by = filter_owner)
      or de.document_id = any(filter_document_ids)
    )
  order by de.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_document_embeddings(vector, integer, double precision, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.match_document_embeddings(vector, integer, double precision, uuid, uuid[]) to service_role;

commit;
