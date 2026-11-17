-- 061: 문서 검색 벡터(document_embeddings) 직접 읽기 차단 — 서버(service role) 전용으로
--
-- 문제(2026-11-17 운영 pg_policies 확인): document_embeddings_select 가 authenticated 전체에 USING (true).
--   지금은 벡터 숫자만 있어 내용이 새지는 않지만, 볼 권한이 없는 문서의 존재(document_id)와 벡터가 모든 직원에게 열려 있고,
--   나중에 이 표에 본문 조각을 담는 순간 그대로 정보 노출이 된다(055·058 과 같은 원칙: 서버만 읽고 쓴다).
-- 영향: 앱에서 이 표를 읽는 곳은 검색 API 의 service role 조회(개수·match_document_embeddings)뿐이라 동작 변화 없음.
-- 되돌리기: create policy "document_embeddings_select" on public.document_embeddings for select to authenticated using (true);
begin;

drop policy if exists "document_embeddings_select" on public.document_embeddings;

commit;
