-- =============================================================================
-- 020_work_logs.sql
-- 업무일지 (work_logs) 및 첨부파일 (work_log_attachments) 테이블
-- =============================================================================

CREATE TABLE work_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date    DATE NOT NULL,
  done        TEXT,
  plan        TEXT,
  note        TEXT,
  is_locked   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);

CREATE INDEX idx_work_logs_user_date ON work_logs(user_id, log_date DESC);
CREATE INDEX idx_work_logs_date ON work_logs(log_date DESC);

CREATE TABLE work_log_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id      UUID NOT NULL REFERENCES work_logs(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  file_id     UUID REFERENCES files(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (document_id IS NOT NULL AND file_id IS NULL) OR
    (document_id IS NULL AND file_id IS NOT NULL)
  )
);

ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_log_attachments ENABLE ROW LEVEL SECURITY;

-- 본인 일지 CRUD
CREATE POLICY "work_logs_own" ON work_logs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 부서장/관리자: 같은 부서 팀원 일지 SELECT
CREATE POLICY "work_logs_manager_read" ON work_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users me
      JOIN users target ON target.id = work_logs.user_id
      WHERE me.id = auth.uid()
        AND me.role IN ('manager', 'admin')
        AND me.department_id = target.department_id
    )
  );

-- 첨부파일: 본인 일지에 대한 CRUD
CREATE POLICY "work_log_attachments_own" ON work_log_attachments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_logs wl
      WHERE wl.id = work_log_attachments.log_id
        AND wl.user_id = auth.uid()
    )
  );
