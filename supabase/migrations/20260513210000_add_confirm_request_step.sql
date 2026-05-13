-- ============================================================
-- Add the confirm-request WhatsApp step to the existing
-- booking_confirmed sequence so the confirm link fires ~1 min after
-- every new booking, regardless of how close the appointment is.
--
-- Sits at step_order=6 (after the existing 0–5 steps). Uses
-- placeholders that replaceVars() in api/automations.js fills in
-- from the booking row: {first_name}, {coach}, {booking_date},
-- {booking_time}, {confirm_url}, {address}, {maps_url}.
--
-- Re-run safe: deletes the existing step_order=6 row before insert.
-- ============================================================

delete from public.automation_steps
 where sequence_id = '22222222-2222-2222-2222-222222222222'
   and step_order  = 6;

insert into public.automation_steps
  (sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
values (
  '22222222-2222-2222-2222-222222222222',
  6,
  'whatsapp',
  60,
  null,
  'Hey {first_name},

It''s {coach} from ReShape :)

Just got your booking through for {booking_date} at {booking_time}. I''ve had a look at your application and I think this will be a great fit for you.

We only take confirmed appointments — please have a look at the page below and let me know if there''s anyone on there you can relate to in terms of starting point and/or goal:

{confirm_url}

This helps us understand where we''re starting from and how we can best help you.

The address is: {address}
📍 {maps_url}

Look forward to meeting you :)
{coach}',
  true
);
