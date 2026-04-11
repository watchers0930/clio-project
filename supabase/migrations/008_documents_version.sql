-- =============================================================================
-- Migration 008: documents 테이블에 버전 관리 컬럼 추가
-- parent_id: 루트(v1) 문서 ID (v1은 null, v2+는 root document id)
-- version_number: 버전 번호 (기본값 1)
-- =============================================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS version_number INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.documents.parent_id IS '루트 문서 ID (v1은 NULL, v2+는 원본 문서 ID)';
COMMENT ON COLUMN public.documents.version_number IS '버전 번호 (1부터 시작)';

CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON public.documents(parent_id);
