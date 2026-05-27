-- Run in Supabase SQL Editor
-- Fixes: "new row violates row-level security policy for table projects"

-- Let authenticated roles call RLS helper functions
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_worker(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO authenticated;

-- Service role used by /api/projects (server-side create)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO service_role;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;

-- Replace insert policy with inline checks (no function permission issues)
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
