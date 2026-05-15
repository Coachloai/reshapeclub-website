-- ============================================================
-- Revoke anon delete on leads
--
-- The previous migration (20260504) allowed anon to delete leads,
-- gated only by client-side auth. This tightens it so only
-- authenticated roles can delete.
-- ============================================================

drop policy if exists "Dashboard can delete leads" on public.leads;

create policy "Dashboard can delete leads"
  on public.leads
  for delete
  to authenticated
  using (true);

revoke delete on public.leads from anon;
