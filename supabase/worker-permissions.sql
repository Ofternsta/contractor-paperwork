-- Per-worker permissions (run in Supabase SQL Editor after roles-and-orgs.sql)
-- Admins manage flags on approved organization_members rows.

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS can_upload boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_delete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_add_events boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_view_files boolean NOT NULL DEFAULT true;

-- Permission check for approved workers; org admins always pass.
CREATE OR REPLACE FUNCTION public.member_has_org_permission(org_id uuid, perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_org_admin(org_id) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.organization_members m
      WHERE m.organization_id = org_id
        AND m.user_id = auth.uid()
        AND m.status = 'approved'
        AND CASE perm
          WHEN 'upload' THEN m.can_upload
          WHEN 'delete' THEN m.can_delete
          WHEN 'add_events' THEN m.can_add_events
          WHEN 'view_files' THEN m.can_view_files
          ELSE false
        END
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_project_files(project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.can_access_project(project_id) THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND public.is_org_admin(p.organization_id)
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND public.is_approved_worker(p.organization_id)
    ) THEN public.member_has_org_permission(
      (SELECT organization_id FROM public.projects WHERE id = project_id),
      'view_files'
    )
    ELSE true
  END;
$$;

-- Storage: project-files
DROP POLICY IF EXISTS "authenticated read project files" ON storage.objects;
CREATE POLICY "authenticated read project files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-files'
    AND public.can_view_project_files(public.storage_project_id(name))
  );

DROP POLICY IF EXISTS "staff upload project files" ON storage.objects;
CREATE POLICY "staff upload project files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = public.storage_project_id(name)
        AND public.member_has_org_permission(p.organization_id, 'upload')
    )
  );

DROP POLICY IF EXISTS "staff update project files" ON storage.objects;
CREATE POLICY "staff update project files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-files'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = public.storage_project_id(name)
        AND public.member_has_org_permission(p.organization_id, 'upload')
    )
  );

DROP POLICY IF EXISTS "admin delete project files" ON storage.objects;
DROP POLICY IF EXISTS "staff delete project files" ON storage.objects;
CREATE POLICY "staff delete project files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-files'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = public.storage_project_id(name)
        AND public.member_has_org_permission(p.organization_id, 'delete')
    )
  );

-- Schedule: require add_events for insert/update; delete aligned with API
DROP POLICY IF EXISTS "staff insert schedule" ON public.schedule_events;
CREATE POLICY "staff insert schedule"
  ON public.schedule_events FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_org_staff_for_project(project_id)
    AND public.member_has_org_permission(organization_id, 'add_events')
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
    AND public.member_has_org_permission(organization_id, 'add_events')
  )
  WITH CHECK (
    public.is_org_staff_for_project(project_id)
    AND public.member_has_org_permission(organization_id, 'add_events')
  );

DROP POLICY IF EXISTS "admin delete schedule" ON public.schedule_events;
DROP POLICY IF EXISTS "staff delete schedule" ON public.schedule_events;
CREATE POLICY "staff delete schedule"
  ON public.schedule_events FOR DELETE TO authenticated
  USING (
    public.is_org_staff_for_project(project_id)
    AND public.member_has_org_permission(
      (SELECT organization_id FROM public.projects WHERE id = schedule_events.project_id),
      'add_events'
    )
  );
