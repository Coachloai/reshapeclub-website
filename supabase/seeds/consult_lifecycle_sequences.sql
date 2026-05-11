-- ============================================================
-- Consult lifecycle nurture sequences
--
-- Two sequences fired from the dashboard when a coach updates a
-- booking's status:
--   consultation_cancelled  (4 messages over 7 days)
--   consultation_noshow     (5 messages over 7 days)
--
-- Bodies are interpolated client-side via replaceVars() in
-- /api/automations.js. Variables used: {first_name}, {coach},
-- {pattern}, {book_link}, {time}.
--
--   {coach}   → resolved by studioMeta(booking) — Sean (Colchester)
--               or Sara (Ipswich).
--   {pattern} → archetype label if the lead took the hormonal quiz,
--               otherwise "the goals you shared with us".
--
-- Run via Supabase Studio SQL Editor. Re-running rebuilds these
-- sequences cleanly (wipes + reinserts).
-- ============================================================

do $$
declare
  seq_id   uuid;
  trig     text;
  triggers text[] := array['consultation_cancelled', 'consultation_noshow'];
begin
  -- Wipe any prior version of these sequences (and their steps).
  foreach trig in array triggers loop
    delete from public.automation_steps
      where sequence_id in (
        select id from public.automation_sequences where trigger_type = trig
      );
    delete from public.automation_sequences where trigger_type = trig;
  end loop;

  -- ── Consultation Cancelled ────────────────────────────────
  insert into public.automation_sequences (name, trigger_type, is_active, description)
  values (
    'Consultation Cancelled',
    'consultation_cancelled',
    true,
    'Fired when a coach marks a booking cancelled. 3 emails + 1 WhatsApp over 7 days. Aims to rebook or gracefully defer.'
  )
  returning id into seq_id;

  insert into public.automation_steps
    (sequence_id, step_order, channel, subject, body, delay_seconds, is_active)
  values
    (seq_id, 1, 'email',
     'Cancellation confirmed — let''s pick a better time',
     E'{first_name}, your consultation is cancelled — no problem, life happens.\n\nThe pattern in your assessment is still there, though, and it isn''t going to resolve itself in the meantime.\n\nPick a slot when you''ve actually got 45 quiet minutes. Don''t squeeze this between school run and Tesco.\n\nRebook here → {book_link}\n\nOr hit reply and tell me what''s going on — I might be able to make this work for you a different way.\n\n— {coach}',
     0, true),
    (seq_id, 2, 'whatsapp',
     null,
     E'Hey {first_name} — saw the cancellation went through. No worries. Want me to send two slots that might work better, or would you rather pick yourself? {book_link}',
     86400, true),
    (seq_id, 3, 'email',
     'Still on the cards?',
     E'{first_name} — quick check-in. No pressure.\n\nYour consultation slot was cancelled but your assessment and pattern report are still on file.\n\nTwo options:\n\n1. Rebook now → {book_link}\n2. Not the right time — reply "later" and I''ll check back in 30 days.\n\nEither way, no hard feelings.\n\n— {coach}',
     259200, true),
    (seq_id, 4, 'email',
     'Door''s open whenever you''re ready',
     E'{first_name} — last note about the cancellation.\n\nYour assessment is on file. Your pattern report is valid. When you''re ready, the consultation is still free.\n\nIn the meantime, I''ll keep sending you the educational emails based on {pattern} — they''re useful regardless of whether you book. If you''d rather not receive them, just reply and I''ll sort it.\n\n— {coach}',
     604800, true);

  -- ── Consultation No-Show ──────────────────────────────────
  insert into public.automation_sequences (name, trigger_type, is_active, description)
  values (
    'Consultation No-Show',
    'consultation_noshow',
    true,
    'Fired when a coach marks a booking no-show. 3 emails + 1 SMS + 1 WhatsApp over 7 days. Friendly tone, easy rebook.'
  )
  returning id into seq_id;

  insert into public.automation_steps
    (sequence_id, step_order, channel, subject, body, delay_seconds, is_active)
  values
    (seq_id, 1, 'email',
     'Missed you — no problem',
     E'{first_name}, looks like we missed each other today. Happens all the time, no concern at all.\n\nWhether something came up or the timing wasn''t right, the easiest thing is to pick a slot you know will work.\n\nNo follow-up needed if today''s not your day — we can find a moment that is.\n\n— {coach}',
     1800, true),
    (seq_id, 2, 'sms',
     null,
     E'ReShape: Hi {first_name}, we had you on the schedule for {time} today. All good — pick a new slot when it suits: {book_link}.',
     3600, true),
    (seq_id, 3, 'email',
     'Three slots for you this week',
     E'{first_name}, no rush — but if you''d like to rebook this week, here are three options.\n\nThe easiest way is to pick whatever works.\n\nBook your free consultation → {book_link}\n\nYour assessment and pattern report are still on file. {coach} will have reviewed everything before you arrive.\n\nIf now''s not the right month, just reply "later" and I''ll check back in 30 days.\n\n— {coach}',
     86400, true),
    (seq_id, 4, 'whatsapp',
     null,
     E'Hey {first_name}, no rush — but if you''d like a slot this week or next, reply with a time that works and I''ll send a one-click link. Or if now''s not the right month, just say "later" and I''ll check back in 30 days. — {coach}',
     172800, true),
    (seq_id, 5, 'email',
     'Last note about the missed consultation',
     E'{first_name} — final message about this.\n\nYour assessment is on file. Your pattern report is valid. When you''re ready, the consultation is still free and {coach} will have read your results before you arrive.\n\nAfter today, you''ll continue receiving the educational emails based on {pattern}. They''re useful regardless.\n\nWhenever you''re ready.\n\nBook your free consultation → {book_link}\n\n— {coach}',
     604800, true);
end $$;
