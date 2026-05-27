-- Restrict UPDATE on claims to organization admins only (workers read-only on status).
-- Run in Supabase SQL Editor after platform-security.sql.

DROP POLICY IF EXISTS "admin worker update claims" ON public.claims;
DROP POLICY IF EXISTS "admin update claims" ON public.claims;
CREATE POLICY "admin update claims"
  ON public.claims FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = claims.project_id
        AND public.is_org_admin(p.organization_id)
    )
  );
