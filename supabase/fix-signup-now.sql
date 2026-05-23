-- LedgerStack: run this entire file once in Supabase → SQL Editor → Run
-- Fixes missing stripe_session_id column + service_role permissions + shows your signup status

-- 1) Column used after Stripe checkout (safe if already exists)
ALTER TABLE public.pending_admin_signups
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

CREATE INDEX IF NOT EXISTS pending_admin_signups_session_idx
  ON public.pending_admin_signups (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- 2) Permissions (fixes "permission denied for table pending_admin_signups")
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_admin_signups TO service_role;
GRANT SELECT, INSERT ON public.email_trial_registry TO service_role;
GRANT SELECT, INSERT ON public.trial_payment_fingerprints TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) TO service_role;

-- 3) Diagnostics for ofternsta@gmail.com (read-only)
SELECT 'pending_admin_signups' AS source, id, email, plan,
       stripe_session_id, consumed_at, created_at, expires_at
FROM public.pending_admin_signups
WHERE lower(email) = 'ofternsta@gmail.com'
ORDER BY created_at DESC;

SELECT 'auth.users' AS source, id, email, created_at
FROM auth.users
WHERE lower(email) = 'ofternsta@gmail.com';
