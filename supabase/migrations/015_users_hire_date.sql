-- =============================================================================
-- CLIO - 직원 입사일·연락처 컬럼 (휴가원 자동입력용)
-- 파일명: supabase/migrations/015_users_hire_date.sql
-- 목적: users 에 입사일·연락처를 추가해 휴가원 폼에서 자동입력
-- 적용: Supabase 대시보드 → SQL Editor 에 붙여넣고 실행
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hire_date         DATE,   -- 입사일
  ADD COLUMN IF NOT EXISTS phone             TEXT;   -- 연락처(비상연락처)

COMMENT ON COLUMN public.users.hire_date IS '입사일 (휴가원 남은휴가 계산 기준)';
COMMENT ON COLUMN public.users.phone     IS '연락처';
