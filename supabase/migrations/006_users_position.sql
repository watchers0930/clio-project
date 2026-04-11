-- =============================================================================
-- Migration 006: users 테이블에 position(직급) 컬럼 추가
-- generate/route.ts에서 userData?.position 참조 중이었으나 컬럼 미존재 버그 수정
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS position TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.users.position IS '사용자 직급 (예: 대리, 과장, 부장, 대표이사)';
