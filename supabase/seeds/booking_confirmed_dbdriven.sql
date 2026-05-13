-- ============================================================
-- DB-driven booking_confirmed sequence (replaces the buggy version)
--
-- Fired by queueSequence('booking_confirmed', ...) from every funnel
-- that books a consult (homepage, /men, /women, /booking, hormonal
-- assessment). Six steps in time-order. All placeholders resolve via
-- replaceVars() in /api/automations.js — make sure that's deployed
-- before running this (it adds {results_url} + {address} + {maps_url}).
--
-- Variables used:
--   {first_name} {coach} {date} {time} {location}
--   {address} {maps_url} {results_url} {pattern}
--
-- Re-running this script wipes the existing booking_confirmed
-- sequence's steps and reinserts these six cleanly.
-- ============================================================

do $$
declare
  seq_id uuid;
begin
  -- Find the existing booking_confirmed sequence (don't create a duplicate).
  select id into seq_id from public.automation_sequences
   where trigger_type = 'booking_confirmed' limit 1;

  if seq_id is null then
    insert into public.automation_sequences (name, trigger_type, is_active, description)
    values (
      'Booking Confirmation',
      'booking_confirmed',
      true,
      'Sent after someone books an appointment. 6 steps spanning booking → 2h before visit.'
    ) returning id into seq_id;
  end if;

  -- Wipe existing steps so we can reinsert in the right order/shape.
  delete from public.automation_steps where sequence_id = seq_id;

  insert into public.automation_steps
    (sequence_id, step_order, channel, subject, body, delay_seconds, is_active)
  values
    -- 0. Immediate email
    (seq_id, 0, 'email',
     'You''re booked! 🎉 See you soon',
     E'Hey {first_name},\n\nYou''re officially booked in — and I can''t wait to meet you!\n\nHere are your visit details:\n\nDate: {date}\nTime: {time}\nLocation: ReShape {location}\nAddress: {address}\n📍 {maps_url}\n\nWear something comfortable. We''ll handle the rest.\n\nA calendar invite is attached so you don''t have to think about it.\n\n— {coach}',
     0, true),

    -- 1. Immediate SMS
    (seq_id, 1, 'sms',
     null,
     E'You''re booked, {first_name}! 🎉 See you on {date} at {time} in {location}. Wear something comfy — looking forward to meeting you! — {coach}',
     0, true),

    -- 2. +60s WhatsApp (warm welcome from the coach)
    (seq_id, 2, 'whatsapp',
     null,
     E'Hey {first_name}! 🎉\n\nIt''s {coach} from Re-Shape — just saw your booking come through for {date} at {time} in {location}.\n\nI''ve had a look at your application and I think this will be a great fit for you. Buzzing to meet you! Wear something comfy and bring a water bottle.\n\nSee you there! 💪',
     60, true),

    -- 3. 24h-before personal WhatsApp (the big one — address + maps + /results link)
    (seq_id, 3, 'whatsapp',
     null,
     E'Hey {first_name}\n\nIt''s {coach} from Re-Shape :)\n\nJust a quick message to let you know your consult tomorrow at {time} will be with me. I''ve looked through your application and I think this will be a great fit for you!\n\nWe only take confirmed appointments — please have a look at the page below and let me know if there''s anyone on there you can relate to in terms of starting point and/or goal:\n\n{results_url}\n\nThis helps us understand where we''re starting from and how we can best help you.\n\nThe address is: {address}\n📍 {maps_url}\n\nLook forward to meeting you at {time} :)\n{coach}',
     -86400, true),

    -- 4. 2h-before SMS reminder
    (seq_id, 4, 'sms',
     null,
     E'Hey {first_name}, {coach} here — see you at {time} for your consult. Address: {address}. {maps_url}',
     -7200, true),

    -- 5. 2h-before email reminder
    (seq_id, 5, 'email',
     'Your ReShape visit is in 2 hours!',
     E'Hey {first_name},\n\nJust a quick note — your visit is in 2 hours.\n\nWe''re at ReShape {location} ({address}) and I''ll be expecting you at {time}.\n\n📍 {maps_url}\n\nIf you''re running late or have any trouble finding us, just give a shout.\n\nSee you soon!\n\n— {coach}',
     -7200, true);

  -- Make sure the sequence is active.
  update public.automation_sequences set is_active = true where id = seq_id;
end $$;
