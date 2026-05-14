CREATE TABLE IF NOT EXISTS public.document_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  granted_to_user uuid REFERENCES public.users(id) ON DELETE CASCADE,
  granted_to_dept uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'read',
  granted_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_document_permission_target CHECK (granted_to_user IS NOT NULL OR granted_to_dept IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_dp_document ON public.document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_dp_user ON public.document_permissions(granted_to_user);
CREATE INDEX IF NOT EXISTS idx_dp_dept ON public.document_permissions(granted_to_dept);

ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dp_select" ON public.document_permissions;
CREATE POLICY "dp_select" ON public.document_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "dp_insert" ON public.document_permissions;
CREATE POLICY "dp_insert" ON public.document_permissions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "dp_delete" ON public.document_permissions;
CREATE POLICY "dp_delete" ON public.document_permissions FOR DELETE TO authenticated USING (true);
