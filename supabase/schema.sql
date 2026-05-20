-- Optional: run in Supabase SQL Editor if you prefer client-side anon access
-- Server API routes use SUPABASE_SERVICE_ROLE_KEY and do not require this.

grant select, insert, delete on table public.claim_evidence to anon;
grant select, insert, delete on table public.claim_evidence to authenticated;

alter table public.claim_evidence enable row level security;

drop policy if exists "anon_select_claim_evidence" on public.claim_evidence;
drop policy if exists "anon_insert_claim_evidence" on public.claim_evidence;
drop policy if exists "anon_delete_claim_evidence" on public.claim_evidence;

create policy "anon_select_claim_evidence"
  on public.claim_evidence for select to anon, authenticated using (true);

create policy "anon_insert_claim_evidence"
  on public.claim_evidence for insert to anon, authenticated with check (true);

create policy "anon_delete_claim_evidence"
  on public.claim_evidence for delete to anon, authenticated using (true);
