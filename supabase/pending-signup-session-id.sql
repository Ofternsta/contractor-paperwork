-- Run in Supabase SQL Editor
ALTER TABLE public.pending_admin_signups
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

CREATE INDEX IF NOT EXISTS pending_admin_signups_session_idx
  ON public.pending_admin_signups (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
