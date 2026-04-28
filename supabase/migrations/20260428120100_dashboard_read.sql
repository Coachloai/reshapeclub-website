-- ============================================================
-- Dashboard read access for hormonal assessments
--
-- The first migration (20260428120000) locked the assessments and
-- assessment_answers tables to the service-role only. The existing
-- ReShape dashboard pattern is anon-key SELECT gated by a client-side
-- password — same as `leads`, `bookings`, and `message_queue`.
--
-- Until the dashboard is migrated to a service-role-only fetch
-- function, allow anon SELECT to keep the dashboard pattern consistent.
-- INSERTs and UPDATEs remain service-role only — the only writes happen
-- through the score-assessment / assessment-session Edge Functions.
-- ============================================================

create policy "Dashboard can read assessments"
  on public.assessments
  for select
  to anon, authenticated
  using (true);

create policy "Dashboard can read assessment_answers"
  on public.assessment_answers
  for select
  to anon, authenticated
  using (true);

grant select on public.assessments        to anon, authenticated;
grant select on public.assessment_answers to anon, authenticated;
