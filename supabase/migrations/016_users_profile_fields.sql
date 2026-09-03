-- =============================================================================
-- CLIO - 직원 프로필 확장 (재직증명서 자동입력용)
-- 파일명: supabase/migrations/016_users_profile_fields.sql
-- 주민번호는 마스킹된 값(앞6+성별1+******)만 저장한다.
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS resident_no TEXT,   -- 주민등록번호(마스킹: 900101-1******)
  ADD COLUMN IF NOT EXISTS address     TEXT,   -- 주소
  ADD COLUMN IF NOT EXISTS position    TEXT;   -- 직위

COMMENT ON COLUMN public.users.resident_no IS '주민등록번호(마스킹 저장: 앞6-성별1******)';
COMMENT ON COLUMN public.users.address     IS '주소';
COMMENT ON COLUMN public.users.position    IS '직위';
