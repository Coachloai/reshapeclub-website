-- ============================================================
-- Form Nurture (form_submitted) — add WhatsApp steps + activate
--
-- Keeps the existing 5 email/SMS steps' bodies intact, just
-- reorders them to make room for 2 new WhatsApp messages at
-- +2h and +48h. Final cadence:
--
--   0  email     +15min     "Welcome to ReShape, {first_name} 👋"
--   1  sms       +1h        Drop in
--   2  whatsapp  +2h        Soft WhatsApp follow-up   ← NEW
--   3  email     +24h       "A little something I wanted to share with you"
--   4  whatsapp  +48h       Confident check-in        ← NEW
--   5  sms       +72h       Checking in
--   6  email     +7d        "One last thing, {first_name}…"
--
-- Variables: {first_name}, {book_link} (or {booking_url} alias).
--
-- Re-running this script is safe: it identifies the 2 new
-- WhatsApp rows by their delay_seconds (7200 and 172800) and
-- deletes those specific rows before reinserting, so existing
-- non-WhatsApp content is never touched.
-- ============================================================

do $$
declare
  seq_id uuid;
begin
  select id into seq_id from public.automation_sequences
   where trigger_type = 'form_submitted' limit 1;

  if seq_id is null then
    raise exception 'form_submitted sequence not found — run the form_submitted seed first';
  end if;

  -- Re-order existing rows so they fit around the new WhatsApp steps.
  -- Identify by delay_seconds (the cadence in the current DB row set).
  update public.automation_steps set step_order = 0 where sequence_id = seq_id and delay_seconds = 900;     -- +15min email
  update public.automation_steps set step_order = 1 where sequence_id = seq_id and delay_seconds = 3600;    -- +1h sms
  update public.automation_steps set step_order = 3 where sequence_id = seq_id and delay_seconds = 86400;   -- +24h email
  update public.automation_steps set step_order = 5 where sequence_id = seq_id and delay_seconds = 259200;  -- +72h sms
  update public.automation_steps set step_order = 6 where sequence_id = seq_id and delay_seconds = 604800;  -- +7d email

  -- Remove any prior versions of these specific WhatsApp rows so this seed is re-runnable.
  delete from public.automation_steps
   where sequence_id = seq_id
     and channel = 'whatsapp'
     and delay_seconds in (7200, 172800);

  insert into public.automation_steps
    (sequence_id, step_order, channel, subject, body, delay_seconds, is_active)
  values
    -- +2h WhatsApp — soft introduction, no pressure
    (seq_id, 2, 'whatsapp',
     null,
     E'Hey {first_name} 👋\n\nJaime here from Re-Shape — wanted to drop in on WhatsApp too in case you''d rather chat here.\n\nHonestly, you don''t need to make a decision today. Just have a look at the slots and pick one that feels right when it does:\n\n{book_link}\n\nNo pressure, promise.',
     7200, true),

    -- +48h WhatsApp — confident check-in, opens the "later" door
    (seq_id, 4, 'whatsapp',
     null,
     E'Hey {first_name}, Jaime again.\n\nI know life gets busy. I just wanted to say — if you do want to chat, I''ve got slots opening up next week:\n\n{book_link}\n\nAnd if now isn''t the right time, just reply and tell me "later" — I''ll check back in a month.',
     172800, true);

  -- Activate the sequence.
  update public.automation_sequences set is_active = true where id = seq_id;
end $$;
