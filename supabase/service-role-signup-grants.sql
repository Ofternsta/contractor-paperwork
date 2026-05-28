-- Run in Supabase SQL Editor
-- Fixes: "permission denied for table profiles" during Finish account setup / webhook signup

-- Server signup (service_role) creates profile, org, subscription after Stripe
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO service_role;

-- Pending signup tables (if not already granted)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_admin_signups TO service_role;
GRANT SELECT, INSERT ON public.email_trial_registry TO service_role;
GRANT SELECT, INSERT ON public.trial_payment_fingerprints TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_client_access TO service_role;
