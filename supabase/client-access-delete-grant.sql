-- Prefer the full script: supabase/project-client-access-grants.sql
-- This file only adds DELETE if you ran an older partial grant.

GRANT DELETE ON TABLE public.project_client_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_client_access TO service_role;
