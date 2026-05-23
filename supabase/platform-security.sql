-- Platform security & billing (run after roles-and-orgs.sql)
-- Tightens storage access to project paths the user can access.

-- Subscriptions (one per organization)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations (id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'starter', 'professional', 'enterprise')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'trialing', 'active', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org admin read subscription" ON public.subscriptions;
CREATE POLICY "org admin read subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "org admin manage subscription" ON public.subscriptions;
CREATE POLICY "org admin manage subscription"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;

-- Client-visible invoices (contractor uploads; clients read only)
CREATE TABLE IF NOT EXISTS public.project_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  title text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project access read invoices" ON public.project_invoices;
CREATE POLICY "project access read invoices"
  ON public.project_invoices FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS "org staff manage invoices" ON public.project_invoices;
CREATE POLICY "org staff manage invoices"
  ON public.project_invoices FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_invoices.project_id
        AND (
          public.is_org_admin(p.organization_id)
          OR public.is_approved_worker(p.organization_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_invoices.project_id
        AND (
          public.is_org_admin(p.organization_id)
          OR public.is_approved_worker(p.organization_id)
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_invoices TO authenticated;

-- Claim timeline events (AI-generated + manual)
CREATE TABLE IF NOT EXISTS public.claim_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims (id) ON DELETE CASCADE,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  description text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai', 'evidence')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.claim_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_claim(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.claims c
    WHERE c.id = cid AND public.can_access_project(c.project_id)
  );
$$;

DROP POLICY IF EXISTS "access claim timeline" ON public.claim_timeline_events;
CREATE POLICY "access claim timeline"
  ON public.claim_timeline_events FOR SELECT TO authenticated
  USING (public.can_access_claim(claim_id));

DROP POLICY IF EXISTS "staff manage claim timeline" ON public.claim_timeline_events;
CREATE POLICY "staff manage claim timeline"
  ON public.claim_timeline_events FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = claim_timeline_events.claim_id
        AND (
          public.is_org_admin(p.organization_id)
          OR public.is_approved_worker(p.organization_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = claim_timeline_events.claim_id
        AND (
          public.is_org_admin(p.organization_id)
          OR public.is_approved_worker(p.organization_id)
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_timeline_events TO authenticated;

-- Workers may update claim fields (not delete)
DROP POLICY IF EXISTS "admin worker update claims" ON public.claims;
CREATE POLICY "admin worker update claims"
  ON public.claims FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = claims.project_id
        AND (
          public.is_org_admin(p.organization_id)
          OR public.is_approved_worker(p.organization_id)
        )
    )
  );

GRANT UPDATE ON public.claims TO authenticated;

-- Storage: scope project-files to users who can_access_project
-- Path format: {projectId}/{claimId}/{filename}
CREATE OR REPLACE FUNCTION public.storage_project_id(object_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(split_part(object_name, '/', 1), '')::uuid;
$$;

DROP POLICY IF EXISTS "authenticated read project files" ON storage.objects;
CREATE POLICY "authenticated read project files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-files'
    AND public.can_access_project(public.storage_project_id(name))
  );

DROP POLICY IF EXISTS "staff upload project files" ON storage.objects;
CREATE POLICY "staff upload project files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = public.storage_project_id(name)
        AND (
          public.is_org_admin(p.organization_id)
          OR public.is_approved_worker(p.organization_id)
        )
    )
  );

DROP POLICY IF EXISTS "admin delete project files" ON storage.objects;
CREATE POLICY "admin delete project files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-files'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = public.storage_project_id(name)
        AND public.is_org_admin(p.organization_id)
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
        AND (
          public.is_org_admin(p.organization_id)
          OR public.is_approved_worker(p.organization_id)
        )
    )
  );
