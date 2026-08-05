-- ============================================================
-- Booking Confirmed — DB-driven nurture sequence
--
-- Confirmation-gated flow:
--   1. Immediate: booking confirmation email + SMS
--   2. 48h before consult: WhatsApp with confirm link
--   3. 24h before consult: Chase WhatsApp if not confirmed
--   4. 3h before consult: Final warning — cancel threat
--   5. 2h before consult: Reminder email + SMS (only if confirmed)
--
-- Steps with delay_seconds > 0 fire after booking creation.
-- Steps with delay_seconds < 0 fire relative to the booking
-- datetime (e.g. -172800 = 48 hours before).
--
-- skip_if_confirmed: if true, step is skipped when booking
-- has confirmed_at set (used for chase/warning messages).
-- skip_if_NOT_confirmed: if true, step is skipped when booking
-- has NOT confirmed (used for day-of reminders).
--
-- Variables resolved client-side by replaceVars() in
-- /api/automations.js:
--   {first_name}, {booking_date}, {booking_time}, {location},
--   {coach}, {confirm_url}, {address}, {maps_url}
--
-- WhatsApp steps use Twilio Content Templates (required outside
-- the 24h conversation window). Template SIDs:
--   booking_confirm_request_v3    HXcd218098e11dc195c681a7c7bfc46772
--   booking_confirm_chase_v3      HX256e6a696b5cf7cd1a0ad6d2c9c7f38d
--   booking_confirm_final_v3      HX851f8ec3f995cff1659bbd50847aaf91
--
-- Re-run safe: wipes existing steps for this sequence before insert.
-- ============================================================

-- Use the fixed UUID for the Booking Confirmation sequence
do $$
declare
  seq_id uuid := '22222222-2222-2222-2222-222222222222';
begin
  -- Ensure the sequence row exists
  insert into public.automation_sequences (id, name, trigger_type, is_active, description)
  values (
    seq_id,
    'Booking Confirmation',
    'booking_confirmed',
    true,
    'Sent after someone books an appointment'
  )
  on conflict (id) do update set
    name        = excluded.name,
    trigger_type = excluded.trigger_type,
    is_active   = excluded.is_active,
    description = excluded.description;

  -- Wipe existing steps
  delete from public.automation_steps where sequence_id = seq_id;

  -- Insert all steps
  -- skip_if_confirmed = chase messages (skip when already confirmed)
  -- skip_if_not_confirmed = day-of reminders (skip when NOT confirmed)
  insert into public.automation_steps
    (sequence_id, step_order, channel, delay_seconds, subject, body, is_active, skip_if_confirmed, skip_if_not_confirmed, template_sid)
  values
    -- Step 0: Confirmation email (immediate) — always send
    (seq_id, 0, 'email', 0,
     E'See you on {booking_date}, {first_name}! \U0001F389',
     E'Hey {first_name},\n\nYou''re officially booked in \u2014 and I can''t wait to meet you!\n\nHere are your visit details:\n\nDate: {booking_date}\nTime: {booking_time}\nLocation: {location}\n\nA few things before you come:\n\n\u2022 Wear something comfortable \u2014 no fancy gym gear needed\n\u2022 Come as you are, no need to "get in shape" first (that''s our job!)\n\u2022 Bring any questions you have \u2014 I''m an open book\n\nThis is just a friendly chat where I get to know you, you get to know us, and we figure out together whether ReShape is the right fit for your goals. There''s zero pressure and zero judgment \u2014 promise.\n\nSee you soon!\nJaime',
     true, false, false, null),

    -- Step 1: Confirmation SMS (immediate) — always send
    (seq_id, 1, 'sms', 0,
     null,
     E'You''re booked, {first_name}! \U0001F389 See you {booking_date} at {booking_time} in {location}. Wear something comfy \u2014 looking forward to meeting you! - Jaime',
     true, false, false, null),

    -- Step 2: Confirm-request WhatsApp (48h before) — SKIP if already confirmed
    -- Uses Twilio Content Template (required outside 24h window)
    (seq_id, 2, 'whatsapp', -172800,
     null,
     E'Hey {first_name}, your consult is coming up on {booking_date} at {booking_time}. Confirm here: {confirm_url}',
     true, true, false, 'HXcd218098e11dc195c681a7c7bfc46772'),

    -- Step 3: Chase WhatsApp (24h before) — SKIP if already confirmed
    (seq_id, 3, 'whatsapp', -86400,
     null,
     E'Hey {first_name}, your consult is TOMORROW at {booking_time} in {location}. Confirm: {confirm_url}',
     true, true, false, 'HX256e6a696b5cf7cd1a0ad6d2c9c7f38d'),

    -- Step 4: Final warning WhatsApp (3h before) — SKIP if already confirmed
    (seq_id, 4, 'whatsapp', -10800,
     null,
     E'Hi {first_name}, your consult is in 3 hours. Confirm or we release your slot: {confirm_url}',
     true, true, false, 'HX851f8ec3f995cff1659bbd50847aaf91'),

    -- Step 5: Reminder email (2h before) — ONLY for CONFIRMED bookings
    (seq_id, 5, 'email', -7200,
     E'See you in 2 hours, {first_name} \U0001F4AA',
     E'Hey {first_name},\n\nJust a quick note \u2014 your visit is in 2 hours!\n\nWe''re at {location} and I''ll be expecting you at {booking_time}. If you''re running late or have any trouble finding us, just give us a shout.\n\nWear something comfortable, bring an open mind, and leave the rest to me. Looking forward to it!\n\nJaime',
     true, false, true, null),

    -- Step 6: Reminder SMS (2h before) — ONLY for CONFIRMED bookings
    (seq_id, 6, 'sms', -7200,
     null,
     E'See you in 2 hours, {first_name} \u2014 {location} at {booking_time}. Drive carefully and we''ll see you soon.',
     true, false, true, null);
end $$;
