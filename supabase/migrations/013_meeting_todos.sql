-- =============================================================================
-- CLIO - 회의록 할일 추출 이력 테이블
-- 파일명: supabase/migrations/013_meeting_todos.sql
-- 목적: 동일 document_id에서 중복 추출 방지 (FR-10)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.todo_extractions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID NOT NULL,                     -- documents.id 참조 (FK 없음 — 유연성 확보)
  extracted_by  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  todo_ids      UUID[] NOT NULL DEFAULT '{}',       -- 실제 등록된 todos.id 배열
  todo_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_todo_extractions_document_id
  ON public.todo_extractions(document_id);

CREATE INDEX IF NOT EXISTS idx_todo_extractions_extracted_by
  ON public.todo_extractions(extracted_by);

-- RLS 활성화
ALTER TABLE public.todo_extractions ENABLE ROW LEVEL SECURITY;

-- 본인이 추출한 이력만 조회 가능
CREATE POLICY "todo_extractions_select" ON public.todo_extractions
  FOR SELECT TO authenticated
  USING (extracted_by = auth.uid());

-- 본인 기록만 INSERT 가능
CREATE POLICY "todo_extractions_insert" ON public.todo_extractions
  FOR INSERT TO authenticated
  WITH CHECK (extracted_by = auth.uid());
