-- ============================================================
-- Allow the dashboard (anon key, gated client-side by password) to
-- delete leads. Matches the existing pattern: anon can SELECT/INSERT
-- the table, with destructive operations gated by client-side auth.
-- ============================================================

drop policy if exists "Dashboard can delete leads" on public.leads;
create policy "Dashboard can delete leads"
  on public.leads
  for delete
  to anon, authenticated
  using (true);

grant delete on public.leads to anon, authenticated;
