-- Custom job titles for approved workers (admin-managed on Team page).
-- Safe to re-run.

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS job_title text;

COMMENT ON COLUMN public.organization_members.job_title IS
  'Display title set by org admin (e.g. Field Technician, Estimator).';
