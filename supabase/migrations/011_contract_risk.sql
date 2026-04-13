-- 계약서 AI 리스크 분석 테이블
-- Migration: 011_contract_risk.sql

CREATE TABLE contract_risk_analyses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_type     TEXT NOT NULL,         -- 'docx' | 'hwpx' | 'pdf'
  contract_type TEXT NOT NULL,         -- 'system' | 'maintenance' | 'software' | 'general'
  perspective   TEXT NOT NULL DEFAULT 'seller_side',  -- 'seller_side' | 'buyer_side'
  raw_text      TEXT,                  -- 추출된 원문 텍스트
  risk_result   JSONB NOT NULL DEFAULT '{}',  -- RiskResult JSON
  risk_count    JSONB NOT NULL DEFAULT '{"high":0,"medium":0,"low":0}',
  status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'processing' | 'done' | 'error'
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE contract_risk_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_risk_select_own"
  ON contract_risk_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "contract_risk_insert_own"
  ON contract_risk_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "contract_risk_update_own"
  ON contract_risk_analyses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "contract_risk_delete_own"
  ON contract_risk_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX idx_contract_risk_user_id
  ON contract_risk_analyses (user_id, created_at DESC);

CREATE INDEX idx_contract_risk_status
  ON contract_risk_analyses (status)
  WHERE status IN ('pending', 'processing');

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_contract_risk_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contract_risk_updated_at
  BEFORE UPDATE ON contract_risk_analyses
  FOR EACH ROW EXECUTE FUNCTION update_contract_risk_updated_at();
