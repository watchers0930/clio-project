-- 법령 조문 청크 테이블 (pgvector RAG)
CREATE TABLE law_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_name    TEXT NOT NULL,
  article_no  TEXT NOT NULL,
  clause_no   TEXT,
  content     TEXT NOT NULL,
  embedding   vector(1536),
  category    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ivfflat 인덱스 (cosine 유사도 검색용)
CREATE INDEX ON law_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- category 사전 필터링용 인덱스
CREATE INDEX idx_law_chunks_category ON law_chunks (category);

-- RLS 활성화
ALTER TABLE law_chunks ENABLE ROW LEVEL SECURITY;

-- 법령은 공공정보 — 모든 사용자 읽기 허용
CREATE POLICY "Public read" ON law_chunks FOR SELECT USING (true);

-- match_law_chunks RPC 함수 (cosine 유사도 검색)
CREATE OR REPLACE FUNCTION match_law_chunks(
  query_embedding vector(1536),
  match_count      INT DEFAULT 3,
  filter_category  TEXT DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  law_name    TEXT,
  article_no  TEXT,
  clause_no   TEXT,
  content     TEXT,
  category    TEXT,
  similarity  FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id, law_name, article_no, clause_no, content, category,
    1 - (embedding <=> query_embedding) AS similarity
  FROM law_chunks
  WHERE (filter_category IS NULL OR category = filter_category)
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
