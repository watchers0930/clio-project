-- 마이그레이션: 010_document_quality_checks.sql
-- 목적: AI 문서 품질 검수 결과 저장 테이블
-- 관련 기능: CLIO AI 문서 품질 검수 (clio-doc-quality)

CREATE TABLE IF NOT EXISTS public.document_quality_checks (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id   UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  checked_by    UUID        NOT NULL REFERENCES public.users(id),
  overall_score INTEGER     CHECK (overall_score BETWEEN 0 AND 100),
  result_json   JSONB       NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE  public.document_quality_checks             IS 'AI 문서 품질 검수 결과 저장';
COMMENT ON COLUMN public.document_quality_checks.result_json IS 'GPT-4o 응답 전체 구조 (QualityCheckResult 타입)';
COMMENT ON COLUMN public.document_quality_checks.overall_score IS '종합 품질 점수 (0~100), GPT-4o 자체 평가';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_quality_checks_document_created
  ON public.document_quality_checks (document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quality_checks_checked_by
  ON public.document_quality_checks (checked_by, created_at DESC);

-- RLS
ALTER TABLE public.document_quality_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quality_checks_select"
  ON public.document_quality_checks FOR SELECT
  USING (
    checked_by = auth.uid()
    OR document_id IN (
      SELECT id FROM public.documents WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "quality_checks_insert"
  ON public.document_quality_checks FOR INSERT
  WITH CHECK (checked_by = auth.uid());

-- 롤백 SQL (긴급 시):
-- DROP TABLE IF EXISTS public.document_quality_checks;
