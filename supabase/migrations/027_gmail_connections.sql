-- Gmail OAuth 연동 테이블
CREATE TABLE IF NOT EXISTS public.user_google_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text NOT NULL,
  access_token     text NOT NULL,
  refresh_token    text NOT NULL,
  token_expiry     timestamptz,
  last_synced_at   timestamptz,
  sync_enabled     boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gmail_conn_own" ON public.user_google_connections
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- files 테이블에 소스 구분 컬럼 추가
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_files_source ON public.files(source);
CREATE INDEX IF NOT EXISTS idx_files_external_id ON public.files(external_id);
