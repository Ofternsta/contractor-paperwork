-- Per-project worker permissions on assignments.
-- Run in Supabase SQL Editor after project-worker-assignments.sql.

ALTER TABLE public.project_worker_assignments
  ADD COLUMN IF NOT EXISTS can_upload boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_delete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_add_events boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_view_files boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.member_has_project_permission(pid uuid, perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.can_access_project(pid) THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = pid AND public.is_org_admin(p.organization_id)
    ) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.project_worker_assignments pwa
      WHERE pwa.project_id = pid
        AND pwa.user_id = auth.uid()
        AND CASE perm
          WHEN 'upload' THEN pwa.can_upload
          WHEN 'delete' THEN pwa.can_delete
          WHEN 'add_events' THEN pwa.can_add_events
          WHEN 'view_files' THEN pwa.can_view_files
          ELSE false
        END
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.member_has_project_permission(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_project_files(project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.member_has_project_permission(project_id, 'view_files');
$$;

DROP POLICY IF EXISTS "staff upload project files" ON storage.objects;
CREATE POLICY "staff upload project files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND public.member_has_project_permission(
      public.storage_project_id(name),
      'upload'
    )
  );

DROP POLICY IF EXISTS "staff update project files" ON storage.objects;
CREATE POLICY "staff update project files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-files'
    AND public.member_has_project_permission(
      public.storage_project_id(name),
      'upload'
    )
  );

DROP POLICY IF EXISTS "staff delete project files" ON storage.objects;
CREATE POLICY "staff delete project files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-files'
    AND public.member_has_project_permission(
      public.storage_project_id(name),
      'delete'
    )
  );

DROP POLICY IF EXISTS "staff insert schedule" ON public.schedule_events;
CREATE POLICY "staff insert schedule"
  ON public.schedule_events FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_org_staff_for_project(project_id)
    AND public.member_has_project_permission(project_id, 'add_events')
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.organization_id = schedule_events.organization_id
    )
  );

DROP POLICY IF EXISTS "staff update schedule" ON public.schedule_events;
CREATE POLICY "staff update schedule"
  ON public.schedule_events FOR UPDATE TO authenticated
  USING (
    public.is_org_staff_for_project(project_id)
    AND public.member_has_project_permission(project_id, 'add_events')
  )
  WITH CHECK (
    public.is_org_staff_for_project(project_id)
    AND public.member_has_project_permission(project_id, 'add_events')
  );

DROP POLICY IF EXISTS "staff delete schedule" ON public.schedule_events;
CREATE POLICY "staff delete schedule"
  ON public.schedule_events FOR DELETE TO authenticated
  USING (
    public.is_org_staff_for_project(project_id)
    AND public.member_has_project_permission(project_id, 'add_events')
  );

DROP POLICY IF EXISTS "admin update project worker assignments" ON public.project_worker_assignments;
CREATE POLICY "admin update project worker assignments"
  ON public.project_worker_assignments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_worker_assignments.project_id
        AND public.is_org_admin(p.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_worker_assignments.project_id
        AND public.is_org_admin(p.organization_id)
    )
  );

GRANT UPDATE ON public.project_worker_assignments TO authenticated;
