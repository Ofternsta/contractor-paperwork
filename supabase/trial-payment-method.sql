-- Run after trial-and-pending-signup.sql

-- Allow trial in pending signups (card collected via Stripe Setup)
ALTER TABLE public.pending_admin_signups DROP CONSTRAINT IF EXISTS pending_admin_signups_plan_check;

ALTER TABLE public.pending_admin_signups
  ADD CONSTRAINT pending_admin_signups_plan_check
  CHECK (plan IN ('trial', 'starter', 'professional', 'enterprise'));

-- One free trial per card fingerprint (stops new emails with same card)
CREATE TABLE IF NOT EXISTS public.trial_payment_fingerprints (
  fingerprint text PRIMARY KEY,
  email text NOT NULL,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL
);

ALTER TABLE public.trial_payment_fingerprints ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.trial_payment_fingerprints TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) TO service_role;
