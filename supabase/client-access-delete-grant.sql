-- Required for admins to revoke client access (Revoke button on project page).
-- Without DELETE, Supabase returns "permission denied for table project_client_access".

GRANT DELETE ON public.project_client_access TO authenticated;
