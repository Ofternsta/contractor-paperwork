-- Run once in Supabase SQL Editor

-- Trial end date on subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Allow expired subscriptions (trial ended)
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('pending', 'trialing', 'active', 'past_due', 'canceled', 'expired'));

-- One free trial per email (ever)
CREATE TABLE IF NOT EXISTS public.email_trial_registry (
  email text PRIMARY KEY,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL
);

ALTER TABLE public.email_trial_registry ENABLE ROW LEVEL SECURITY;

-- Paid signup: account created in Stripe webhook after payment
CREATE TABLE IF NOT EXISTS public.pending_admin_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_encrypted text NOT NULL,
  full_name text,
  organization_name text NOT NULL DEFAULT 'My Company',
  plan text NOT NULL CHECK (plan IN ('trial', 'starter', 'professional', 'enterprise')),
  stripe_session_id text,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours')
);

CREATE INDEX IF NOT EXISTS pending_admin_signups_email_idx
  ON public.pending_admin_signups (lower(email))
  WHERE consumed_at IS NULL;

ALTER TABLE public.pending_admin_signups ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_admin_signups TO service_role;
GRANT SELECT, INSERT ON public.email_trial_registry TO service_role;

-- Only service role uses these tables (no client policies)

CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(user_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(user_email)) LIMIT 1;
$$;
