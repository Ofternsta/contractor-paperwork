-- Optional: hard-delete rows. Revoke in the app uses status = 'rejected' (UPDATE only).
-- Run if you still want DELETE available for maintenance.

GRANT DELETE ON public.project_client_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_client_access TO service_role;
