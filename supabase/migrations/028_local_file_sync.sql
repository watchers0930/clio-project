-- 로컬 파일 인덱스 (파일 원본 미업로드, 메타데이터만 저장)
CREATE TABLE IF NOT EXISTS local_file_index (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_hash text NOT NULL,
  file_size bigint,
  last_modified bigint,
  last_synced_at timestamptz DEFAULT now(),
  chunk_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, file_path)
);

-- 로컬 파일 청크 + 벡터 임베딩
CREATE TABLE IF NOT EXISTS local_file_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  local_file_id uuid REFERENCES local_file_index(id) ON DELETE CASCADE NOT NULL,
  chunk_index int NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

-- ivfflat 인덱스
CREATE INDEX IF NOT EXISTS local_file_chunks_embedding_idx
  ON local_file_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS
ALTER TABLE local_file_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_file_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "local_file_index_own" ON local_file_index
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "local_file_chunks_own" ON local_file_chunks
  FOR ALL USING (
    local_file_id IN (
      SELECT id FROM local_file_index WHERE user_id = auth.uid()
    )
  );

-- 벡터 유사도 검색 RPC
CREATE OR REPLACE FUNCTION match_local_file_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  local_file_id uuid,
  content text,
  similarity float,
  file_name text,
  file_path text,
  file_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lfc.id,
    lfc.local_file_id,
    lfc.content,
    1 - (lfc.embedding <=> query_embedding) AS similarity,
    lfi.file_name,
    lfi.file_path,
    lfi.file_type
  FROM local_file_chunks lfc
  JOIN local_file_index lfi ON lfi.id = lfc.local_file_id
  WHERE lfi.user_id = p_user_id
    AND 1 - (lfc.embedding <=> query_embedding) > match_threshold
  ORDER BY lfc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
