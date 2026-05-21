-- Run once in Supabase Dashboard → SQL Editor after enabling Email auth
-- Authentication → Providers → Email → Enable
--
-- Optional: disable "Confirm email" for faster testing (Authentication → Providers → Email)

-- Tie projects to the logged-in user
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;

-- Remove open anon access (login required)
DROP POLICY IF EXISTS "anon select projects" ON public.projects;
DROP POLICY IF EXISTS "anon insert projects" ON public.projects;
DROP POLICY IF EXISTS "anon delete projects" ON public.projects;
DROP POLICY IF EXISTS "anon select claims" ON public.claims;
DROP POLICY IF EXISTS "anon insert claims" ON public.claims;
DROP POLICY IF EXISTS "anon delete claims" ON public.claims;

-- Projects: only your rows
GRANT SELECT, INSERT, DELETE ON TABLE public.projects TO authenticated;

DROP POLICY IF EXISTS "users select own projects" ON public.projects;
CREATE POLICY "users select own projects"
  ON public.projects FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users insert own projects" ON public.projects;
CREATE POLICY "users insert own projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users delete own projects" ON public.projects;
CREATE POLICY "users delete own projects"
  ON public.projects FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Claims: only on your projects
GRANT SELECT, INSERT, DELETE ON TABLE public.claims TO authenticated;

DROP POLICY IF EXISTS "users select own claims" ON public.claims;
CREATE POLICY "users select own claims"
  ON public.claims FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = claims.project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users insert own claims" ON public.claims;
CREATE POLICY "users insert own claims"
  ON public.claims FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = claims.project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users delete own claims" ON public.claims;
CREATE POLICY "users delete own claims"
  ON public.claims FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = claims.project_id AND p.user_id = auth.uid()
    )
  );

-- Storage: logged-in users only (see storage-policies.sql for bucket policies)
DROP POLICY IF EXISTS "anon upload project files" ON storage.objects;
DROP POLICY IF EXISTS "anon read project files" ON storage.objects;
DROP POLICY IF EXISTS "anon update project files" ON storage.objects;
DROP POLICY IF EXISTS "anon delete project files" ON storage.objects;

DROP POLICY IF EXISTS "authenticated upload project files" ON storage.objects;
CREATE POLICY "authenticated upload project files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files');

DROP POLICY IF EXISTS "authenticated read project files" ON storage.objects;
CREATE POLICY "authenticated read project files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files');

DROP POLICY IF EXISTS "authenticated update project files" ON storage.objects;
CREATE POLICY "authenticated update project files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-files')
  WITH CHECK (bucket_id = 'project-files');

DROP POLICY IF EXISTS "authenticated delete project files" ON storage.objects;
CREATE POLICY "authenticated delete project files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files');
