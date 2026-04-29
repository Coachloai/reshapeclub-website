-- ============================================================
-- Adds the personalised `readout` column to assessments.
--
-- The readout is assembled inside the score-assessment Edge Function
-- after the user submits the final question. It contains the per-user
-- mirror narrative, objections, secondary archetype line, and Q14
-- closer — built from the same answers that produced the score.
--
-- Persisted (not regenerated per request) so that:
--  * a refresh shows the same lines they saw the first time
--  * the dashboard can read past readouts
--  * future re-scoring keeps an audit trail of what the user saw
-- ============================================================

alter table public.assessments
  add column if not exists readout jsonb;
