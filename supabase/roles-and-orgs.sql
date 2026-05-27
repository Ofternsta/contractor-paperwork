-- Run in Supabase SQL Editor (after Email auth is enabled)
-- Roles: admin, worker (org approval), client (per-project approval)

-- Profiles (one per auth user)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'worker', 'client')),
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own profile" ON public.profiles;
CREATE POLICY "users read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "users insert own profile" ON public.profiles;
CREATE POLICY "users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;

-- Organizations (owned by admin)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Company',
  invite_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO service_role;

-- Workers request to join via invite_code (one-time admin approval)
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users (id),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO service_role;

DROP POLICY IF EXISTS "admin read worker profiles" ON public.profiles;
CREATE POLICY "admin read worker profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      JOIN public.organizations o ON o.id = m.organization_id
      WHERE m.user_id = profiles.id AND o.admin_user_id = auth.uid()
    )
  );

-- Clients: one-time admin approval per project
CREATE TABLE IF NOT EXISTS public.project_client_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  client_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users (id),
  UNIQUE (project_id, client_email)
);

ALTER TABLE public.project_client_access ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.project_client_access TO authenticated;

-- Projects belong to an organization
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

-- Helper: is current user admin of org
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_id AND o.admin_user_id = auth.uid()
  );
$$;

-- Helper: is approved worker in org
CREATE OR REPLACE FUNCTION public.is_approved_worker(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = org_id
      AND m.user_id = auth.uid()
      AND m.status = 'approved'
  );
$$;

-- Helper: can access project (admin, worker in org, or approved client)
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
        OR public.is_approved_worker(p.organization_id)
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

-- Organizations policies
DROP POLICY IF EXISTS "admin read own org" ON public.organizations;
CREATE POLICY "admin read own org"
  ON public.organizations FOR SELECT TO authenticated
  USING (admin_user_id = auth.uid());

DROP POLICY IF EXISTS "workers read member org" ON public.organizations;
CREATE POLICY "workers read member org"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = organizations.id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "anyone read org by invite code" ON public.organizations;
CREATE POLICY "anyone read org by invite code"
  ON public.organizations FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin insert org" ON public.organizations;
CREATE POLICY "admin insert org"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (admin_user_id = auth.uid());

DROP POLICY IF EXISTS "admin update own org" ON public.organizations;
CREATE POLICY "admin update own org"
  ON public.organizations FOR UPDATE TO authenticated
  USING (admin_user_id = auth.uid());

-- Organization members
DROP POLICY IF EXISTS "user read own membership" ON public.organization_members;
CREATE POLICY "user read own membership"
  ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin read org members" ON public.organization_members;
CREATE POLICY "admin read org members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "worker request join" ON public.organization_members;
CREATE POLICY "worker request join"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "admin update members" ON public.organization_members;
CREATE POLICY "admin update members"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id));

-- Project client access
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

DROP POLICY IF EXISTS "client read own access" ON public.project_client_access;
CREATE POLICY "client read own access"
  ON public.project_client_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR client_email = (auth.jwt() ->> 'email'));

-- Projects: replace old policies
DROP POLICY IF EXISTS "users select own projects" ON public.projects;
DROP POLICY IF EXISTS "users insert own projects" ON public.projects;
DROP POLICY IF EXISTS "users delete own projects" ON public.projects;

DROP POLICY IF EXISTS "org members select projects" ON public.projects;
CREATE POLICY "org members select projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.can_access_project(id));

DROP POLICY IF EXISTS "admin worker insert projects" ON public.projects;
DROP POLICY IF EXISTS "admin insert projects" ON public.projects;
CREATE POLICY "admin insert projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id IS NOT NULL
    AND public.is_org_admin(organization_id)
  );

GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_worker(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO authenticated;

DROP POLICY IF EXISTS "admin delete projects" ON public.projects;
CREATE POLICY "admin delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id));

-- Claims
DROP POLICY IF EXISTS "users select own claims" ON public.claims;
DROP POLICY IF EXISTS "users insert own claims" ON public.claims;
DROP POLICY IF EXISTS "users delete own claims" ON public.claims;

DROP POLICY IF EXISTS "access project claims select" ON public.claims;
CREATE POLICY "access project claims select"
  ON public.claims FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS "admin worker insert claims" ON public.claims;
CREATE POLICY "admin worker insert claims"
  ON public.claims FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = claims.project_id
        AND (
          public.is_org_admin(p.organization_id)
          OR public.is_approved_worker(p.organization_id)
        )
    )
  );

DROP POLICY IF EXISTS "admin delete claims" ON public.claims;
CREATE POLICY "admin delete claims"
  ON public.claims FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = claims.project_id AND public.is_org_admin(p.organization_id)
    )
  );

GRANT SELECT, INSERT, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.claims TO authenticated;

-- Link existing projects to admin organizations (run after admins have signed up)
UPDATE public.projects p
SET organization_id = o.id
FROM public.organizations o
WHERE p.organization_id IS NULL
  AND p.user_id = o.admin_user_id;
