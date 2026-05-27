-- Only org admins may create projects (workers cannot).
-- Safe to re-run. Run in Supabase SQL Editor after roles-and-orgs.sql.

DROP POLICY IF EXISTS "users insert own projects" ON public.projects;
DROP POLICY IF EXISTS "admin worker insert projects" ON public.projects;
DROP POLICY IF EXISTS "admin insert projects" ON public.projects;

CREATE POLICY "admin insert projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id IS NOT NULL
    AND public.is_org_admin(organization_id)
  );
