-- Structured claim status workflow (run in Supabase SQL Editor)

UPDATE public.claims
SET status = 'Inspection'
WHERE status IS NULL
   OR trim(status) = ''
   OR status NOT IN (
     'Inspection',
     'Documentation',
     'Estimate Sent',
     'Approved',
     'In Progress',
     'Completed'
   );

ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS claims_status_check;

ALTER TABLE public.claims
  ADD CONSTRAINT claims_status_check
  CHECK (status IN (
    'Inspection',
    'Documentation',
    'Estimate Sent',
    'Approved',
    'In Progress',
    'Completed'
  ));
