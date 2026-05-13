-- One-shot: clear the current rate-limit counters so dev iteration on
-- the assessment isn't blocked by the previous 5/hour cap. Re-running
-- this is harmless — it just zeroes the table again. Safe to keep in
-- the migration history.

delete from public.rate_limits
 where bucket in ('score_assessment', 'assessment_session');
