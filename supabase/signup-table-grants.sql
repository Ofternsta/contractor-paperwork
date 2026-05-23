-- Run in Supabase SQL Editor if signup shows:
-- "permission denied for table pending_admin_signups"

-- Server-only tables (API uses service_role key)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_admin_signups TO service_role;
GRANT SELECT, INSERT ON public.email_trial_registry TO service_role;
GRANT SELECT, INSERT ON public.trial_payment_fingerprints TO service_role;

-- Allow service role to call auth lookup helper
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) TO service_role;
