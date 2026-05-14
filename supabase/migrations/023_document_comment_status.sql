-- ============================================================
-- Migration 023: document_comments 상태 및 반영 이력 추가
-- ============================================================

ALTER TABLE public.document_comments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'held', 'applied')),
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applied_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_version_number INTEGER;

CREATE INDEX IF NOT EXISTS idx_document_comments_status
  ON public.document_comments(status);
