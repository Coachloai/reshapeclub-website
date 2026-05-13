-- ============================================================
-- Booking Confirmed — DB-driven nurture sequence
--
-- 7 steps across email, SMS, and WhatsApp.
-- Steps with delay_seconds > 0 fire after booking creation.
-- Steps with delay_seconds < 0 fire relative to the booking
-- datetime (e.g. -86400 = 24 hours before, -7200 = 2 hours before).
--
-- Variables resolved client-side by replaceVars() in
-- /api/automations.js:
--   {first_name}, {booking_date}, {booking_time}, {location},
--   {coach}, {confirm_url}, {address}, {maps_url}
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
  insert into public.automation_steps
    (sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
  values
    -- Step 0: Confirmation email (immediate)
    (seq_id, 0, 'email', 0,
     E'See you on {booking_date}, {first_name}! \U0001F389',
     E'Hey {first_name},\n\nYou''re officially booked in \u2014 and I can''t wait to meet you!\n\nHere are your visit details:\n\nDate: {booking_date}\nTime: {booking_time}\nLocation: {location}\n\nA few things before you come:\n\n\u2022 Wear something comfortable \u2014 no fancy gym gear needed\n\u2022 Come as you are, no need to "get in shape" first (that''s our job!)\n\u2022 Bring any questions you have \u2014 I''m an open book\n\nThis is just a friendly chat where I get to know you, you get to know us, and we figure out together whether ReShape is the right fit for your goals. There''s zero pressure and zero judgment \u2014 promise.\n\nSee you soon!\nJaime',
     true),

    -- Step 1: Confirmation SMS (immediate)
    (seq_id, 1, 'sms', 0,
     null,
     E'You''re booked, {first_name}! \U0001F389 See you {booking_date} at {booking_time} in {location}. Wear something comfy \u2014 looking forward to meeting you! - Jaime',
     true),

    -- Step 2: Reminder SMS (24 hours before booking)
    (seq_id, 2, 'sms', -86400,
     null,
     E'Hey {first_name}, just a friendly reminder \u2014 your visit is TOMORROW at {booking_time} in {location}. Can''t wait to meet you! Any questions before then, just reply to this message \U0001F642 - Jaime',
     true),

    -- Step 3: Reminder email (2 hours before booking)
    (seq_id, 3, 'email', -7200,
     E'See you in 2 hours, {first_name} \U0001F4AA',
     E'Hey {first_name},\n\nJust a quick note \u2014 your visit is in 2 hours!\n\nWe''re at {location} and I''ll be expecting you at {booking_time}. If you''re running late or have any trouble finding us, just give us a shout.\n\nWear something comfortable, bring an open mind, and leave the rest to me. Looking forward to it!\n\nJaime',
     true),

    -- Step 4: Reminder SMS (2 hours before booking)
    (seq_id, 4, 'sms', -7200,
     null,
     E'See you in 2 hours, {first_name} \u2014 {location} at {booking_time}. Drive carefully and we''ll see you soon.',
     true),

    -- Step 5: Confirm-request WhatsApp (1 minute after booking)
    (seq_id, 5, 'whatsapp', 60,
     null,
     E'Hey {first_name},\n\nIt''s {coach} from ReShape :)\n\nJust got your booking through for {booking_date} at {booking_time}. I''ve had a look at your application and I think this will be a great fit for you.\n\nWe only take confirmed appointments \u2014 please have a look at the page below and let me know if there''s anyone on there you can relate to in terms of starting point and/or goal:\n\n{confirm_url}\n\nThis helps us understand where we''re starting from and how we can best help you.\n\nThe address is: {address}\n\U0001F4CD {maps_url}\n\nLook forward to meeting you :)\n{coach}',
     true);
end $$;
