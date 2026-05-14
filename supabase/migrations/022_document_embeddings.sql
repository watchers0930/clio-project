-- document-search 기능: AI 생성 문서 벡터 임베딩
-- 마이그레이션: 022_document_embeddings.sql

-- document_embeddings 테이블
CREATE TABLE IF NOT EXISTS document_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  embedding   vector(1536) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id)
);

-- 소규모(~수천 건)에서는 sequential scan이 더 정확 — 문서가 10만 건 이상이면 ivfflat으로 교체
-- CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector
--   ON document_embeddings USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_document_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_document_embeddings_updated_at
  BEFORE UPDATE ON document_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_document_embeddings_updated_at();

-- RLS 활성화
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 모두 읽기 가능 (문서는 회사 공용)
CREATE POLICY "document_embeddings_select" ON document_embeddings
  FOR SELECT TO authenticated USING (true);

-- 쓰기는 service_role만 (서버 API에서 service role 사용)
CREATE POLICY "document_embeddings_insert" ON document_embeddings
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "document_embeddings_update" ON document_embeddings
  FOR UPDATE TO service_role USING (true);

CREATE POLICY "document_embeddings_delete" ON document_embeddings
  FOR DELETE TO service_role USING (true);

-- match_document_embeddings RPC: 문서 벡터 검색
CREATE OR REPLACE FUNCTION match_document_embeddings(
  query_embedding   vector(1536),
  match_count       INT DEFAULT 10,
  match_threshold   FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  document_id UUID,
  similarity  FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    de.document_id,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM document_embeddings de
  WHERE 1 - (de.embedding <=> query_embedding) >= match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;
