-- 마이그레이션: 012_schedules_expiry.sql
-- 목적: schedules 테이블에 문서 만료일 자동 추출 추적 컬럼 추가
-- 관련 기능: CLIO 계약/문서 만료일 자동 알림 (clio-expiry-alert)

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS source_type TEXT,        -- 'document_expiry' | NULL (수동 일정은 NULL)
  ADD COLUMN IF NOT EXISTS source_id UUID,           -- files.id 역참조 (어느 파일에서 추출됐는지)
  ADD COLUMN IF NOT EXISTS expiry_confidence TEXT;   -- 'high' | 'low' | 'none' (AI 추출 신뢰도)

-- 인덱스: source_type 기반 필터링 최적화
CREATE INDEX IF NOT EXISTS idx_schedules_source_type ON schedules(source_type);
CREATE INDEX IF NOT EXISTS idx_schedules_source_id ON schedules(source_id);

-- RLS 확인: 기존 schedules 테이블 RLS가 user_id = auth.uid() 조건으로 적용되어 있어야 함
-- 추가 RLS 정책 불필요 (기존 정책으로 자동 격리)

-- 롤백 SQL (긴급 시 사용):
-- ALTER TABLE schedules
--   DROP COLUMN IF EXISTS source_type,
--   DROP COLUMN IF EXISTS source_id,
--   DROP COLUMN IF EXISTS expiry_confidence;
-- DROP INDEX IF EXISTS idx_schedules_source_type;
-- DROP INDEX IF EXISTS idx_schedules_source_id;
