-- =============================================================================
-- Migration 009: shared_links 테이블 생성 (외부 공유 링크)
-- token: 고유 공유 토큰 (32자 hex)
-- resource_type: 'document' | 'file'
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('document', 'file')),
  resource_id UUID NOT NULL,
  title TEXT,
  expires_at TIMESTAMPTZ,
  password_hash TEXT,
  view_count INT NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_links_token ON public.shared_links(token);
CREATE INDEX IF NOT EXISTS idx_shared_links_created_by ON public.shared_links(created_by);

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_links_owner" ON public.shared_links;
CREATE POLICY "shared_links_owner" ON public.shared_links
  FOR ALL USING (created_by = auth.uid());
