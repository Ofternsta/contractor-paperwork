-- Run once in Supabase SQL Editor.
-- Fixes: "permission denied for table project_client_access" when granting or revoking client access.

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_client_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_client_access TO service_role;

-- Admin: full manage for projects in their organization
DROP POLICY IF EXISTS "admin manage project clients" ON public.project_client_access;
CREATE POLICY "admin manage project clients"
  ON public.project_client_access FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_client_access.project_id
        AND public.is_org_admin(p.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_client_access.project_id
        AND public.is_org_admin(p.organization_id)
    )
  );

-- Client: read own invites
DROP POLICY IF EXISTS "client read own access" ON public.project_client_access;
CREATE POLICY "client read own access"
  ON public.project_client_access FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR lower(client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Client: attach their user id after login (link-client-access)
DROP POLICY IF EXISTS "client link own access" ON public.project_client_access;
CREATE POLICY "client link own access"
  ON public.project_client_access FOR UPDATE TO authenticated
  USING (
    status = 'approved'
    AND lower(client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    user_id = auth.uid()
    AND lower(client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
