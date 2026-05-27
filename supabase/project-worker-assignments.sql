-- Workers only see projects explicitly assigned by an org admin.
-- Run in Supabase SQL Editor after roles-and-orgs.sql and worker-permissions.sql.

CREATE TABLE IF NOT EXISTS public.project_worker_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users (id),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_worker_assignments_user_idx
  ON public.project_worker_assignments (user_id);

CREATE INDEX IF NOT EXISTS project_worker_assignments_project_idx
  ON public.project_worker_assignments (project_id);

ALTER TABLE public.project_worker_assignments ENABLE ROW LEVEL SECURITY;

-- Helper: worker assigned to this project
CREATE OR REPLACE FUNCTION public.is_worker_assigned_to_project(pid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_worker_assignments pwa
    WHERE pwa.project_id = pid AND pwa.user_id = auth.uid()
  );
$$;

-- Replace can_access_project: workers need assignment (not all org projects)
CREATE OR REPLACE FUNCTION public.can_access_project(pid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = pid
      AND (
        public.is_org_admin(p.organization_id)
        OR (
          public.is_approved_worker(p.organization_id)
          AND public.is_worker_assigned_to_project(pid)
        )
        OR EXISTS (
          SELECT 1 FROM public.project_client_access pca
          WHERE pca.project_id = pid
            AND pca.status = 'approved'
            AND (
              pca.user_id = auth.uid()
              OR lower(pca.client_email) = lower(auth.jwt() ->> 'email')
            )
        )
      )
  );
$$;

-- Staff features (schedule, notes) follow same project access
CREATE OR REPLACE FUNCTION public.is_org_staff_for_project(pid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_project(pid)
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role = 'client'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_worker_assigned_to_project(uuid) TO authenticated;

-- RLS: workers see own assignments; admins manage for their org's projects
DROP POLICY IF EXISTS "worker read own project assignments" ON public.project_worker_assignments;
CREATE POLICY "worker read own project assignments"
  ON public.project_worker_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin read project worker assignments" ON public.project_worker_assignments;
CREATE POLICY "admin read project worker assignments"
  ON public.project_worker_assignments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_worker_assignments.project_id
        AND public.is_org_admin(p.organization_id)
    )
  );

DROP POLICY IF EXISTS "admin insert project worker assignments" ON public.project_worker_assignments;
CREATE POLICY "admin insert project worker assignments"
  ON public.project_worker_assignments FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_worker_assignments.project_id
        AND public.is_org_admin(p.organization_id)
    )
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      JOIN public.projects p ON p.id = project_worker_assignments.project_id
      WHERE m.user_id = project_worker_assignments.user_id
        AND m.organization_id = p.organization_id
        AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "admin delete project worker assignments" ON public.project_worker_assignments;
CREATE POLICY "admin delete project worker assignments"
  ON public.project_worker_assignments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_worker_assignments.project_id
        AND public.is_org_admin(p.organization_id)
    )
  );

GRANT SELECT, INSERT, DELETE ON public.project_worker_assignments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.project_worker_assignments TO service_role;

-- Claims: workers may only add to projects they can access (assigned)
DROP POLICY IF EXISTS "admin worker insert claims" ON public.claims;
CREATE POLICY "admin worker insert claims"
  ON public.claims FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = claims.project_id
        AND public.can_access_project(p.id)
        AND EXISTS (
          SELECT 1 FROM public.profiles pr
          WHERE pr.id = auth.uid() AND pr.role IN ('admin', 'worker')
        )
    )
  );
