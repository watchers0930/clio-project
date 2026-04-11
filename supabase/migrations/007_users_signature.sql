-- =============================================================================
-- Migration 007: users 테이블에 signature_path(서명 이미지 경로) 컬럼 추가
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signature_path TEXT;

COMMENT ON COLUMN public.users.signature_path IS '사용자 서명 이미지 Storage 경로 (signatures/{user_id}/signature.png)';
