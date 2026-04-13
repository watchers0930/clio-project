-- ============================================================
-- Migration 015: 결재 시스템 제거 + 문서 댓글 시스템 추가
-- ============================================================

-- 1. 결재 테이블 삭제
DROP TABLE IF EXISTS approvals CASCADE;

-- 2. 문서 status 값 정리 (결재 관련 상태 → completed)
UPDATE documents
SET status = 'completed'
WHERE status IN ('submitted', 'approved', 'rejected');

-- 3. document_comments 테이블 생성
CREATE TABLE IF NOT EXISTS document_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) > 0),
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_document_comments_document_id ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_created_at ON document_comments(created_at DESC);

-- 4. RLS 활성화
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- 로그인 사용자 전체 읽기
CREATE POLICY "comments_select" ON document_comments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 로그인 사용자 댓글 작성 (본인 user_id만)
CREATE POLICY "comments_insert" ON document_comments
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

-- 본인 댓글만 삭제
CREATE POLICY "comments_delete" ON document_comments
  FOR DELETE
  USING (auth.uid()::text = user_id::text);
