-- memo-insight 기능: pgvector 임베딩 + 클러스터 캐시
-- 마이그레이션: 021_memo_embeddings.sql

-- memo_embeddings 테이블
CREATE TABLE memo_embeddings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id    UUID NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  embedding  vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(memo_id)
);

-- ivfflat 인덱스 (코사인 유사도 검색)
CREATE INDEX idx_memo_embeddings_vector
  ON memo_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_memo_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_memo_embeddings_updated_at
  BEFORE UPDATE ON memo_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_memo_embeddings_updated_at();

-- memo_groups 테이블 (클러스터 캐시, TTL 1시간)
CREATE TABLE memo_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  memo_ids   UUID[] NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memo_groups_user ON memo_groups(user_id, expires_at);

-- RLS 활성화
ALTER TABLE memo_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE memo_groups ENABLE ROW LEVEL SECURITY;

-- memo_embeddings: 메모 소유자만 접근
CREATE POLICY "memo_embeddings_own" ON memo_embeddings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memos m
      WHERE m.id = memo_embeddings.memo_id
        AND m.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memos m
      WHERE m.id = memo_embeddings.memo_id
        AND m.created_by = auth.uid()
    )
  );

-- memo_groups: 본인 그룹만 접근
CREATE POLICY "memo_groups_own" ON memo_groups
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- match_memo_embeddings RPC: 유사 메모 검색
CREATE OR REPLACE FUNCTION match_memo_embeddings(
  query_embedding      vector(1536),
  match_user_id        UUID,
  exclude_memo_id      UUID,
  match_count          INT DEFAULT 3,
  similarity_threshold FLOAT DEFAULT 0.75
)
RETURNS TABLE (
  memo_id    UUID,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    me.memo_id,
    1 - (me.embedding <=> query_embedding) AS similarity
  FROM memo_embeddings me
  JOIN memos m ON m.id = me.memo_id
  WHERE m.created_by = match_user_id
    AND me.memo_id != exclude_memo_id
    AND 1 - (me.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY me.embedding <=> query_embedding
  LIMIT match_count;
$$;
