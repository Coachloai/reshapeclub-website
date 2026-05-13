-- ============================================================
-- Form Submitted — DB-driven nurture sequence
--
-- 7 steps across email, SMS, and WhatsApp over 7 days.
-- Fired after someone submits the application form (no booking).
-- Aims to move leads from application to booking a visit.
--
-- Variables resolved client-side by replaceVars() in
-- /api/automations.js:
--   {first_name}, {book_link}
--
-- Re-run safe: wipes existing steps for this sequence before insert.
-- ============================================================

do $$
declare
  seq_id uuid := '11111111-1111-1111-1111-111111111111';
begin
  -- Ensure the sequence row exists and is active
  insert into public.automation_sequences (id, name, trigger_type, is_active, description)
  values (
    seq_id,
    'Form Nurture',
    'form_submitted',
    true,
    'Sent after someone submits the application form. 3 emails + 2 SMS + 2 WhatsApp over 7 days to drive bookings.'
  )
  on conflict (id) do update set
    name        = excluded.name,
    trigger_type = excluded.trigger_type,
    is_active   = true,
    description = excluded.description;

  -- Wipe existing steps
  delete from public.automation_steps where sequence_id = seq_id;

  -- Insert all steps
  insert into public.automation_steps
    (sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
  values
    -- Step 0: Confirmation email (immediate)
    (seq_id, 0, 'email', 0,
     E'Application received \u2014 here''s what happens next',
     E'Hey {first_name}, we got your application!\n\nThanks for applying to ReShape. We''re reviewing your details now.\n\nIn the meantime, why not book your consult? Spots fill up fast.\n\nBook your visit \u2192 {book_link}',
     true),

    -- Step 1: SMS (1 hour)
    (seq_id, 1, 'sms', 3600,
     null,
     E'Hey {first_name}, it''s Jaime from ReShape. We got your application! Book your in-person visit before spots fill up: {book_link}',
     true),

    -- Step 2: WhatsApp (2 hours)
    (seq_id, 2, 'whatsapp', 7200,
     null,
     E'Hey {first_name}!\n\nIt''s Jaime from ReShape. Just seen your application come through \u2014 love that you''re taking the first step!\n\nFancy popping in for a visit? I''d love to chat about your goals in person.\n\nBook here: {book_link}',
     true),

    -- Step 3: Email (1 day)
    (seq_id, 3, 'email', 86400,
     E'People like you are getting results',
     E'{first_name}, people just like you are transforming.\n\nSince you applied, 3 more people have started their journey with us.\n\nOur members lose an average of 8\u201312kg in 12 weeks. And if they don''t? We coach them for free until they do.\n\nDon''t let this opportunity pass \u2014 book your consult now.\n\nBook your visit \u2192 {book_link}',
     true),

    -- Step 4: WhatsApp (2 days)
    (seq_id, 4, 'whatsapp', 172800,
     null,
     E'Hey {first_name}, quick one from Jaime\n\nI had a look at your application and I genuinely think we can help you hit your goals. Spots are filling up though \u2014 grab yours here: {book_link}',
     true),

    -- Step 5: SMS (3 days)
    (seq_id, 5, 'sms', 259200,
     null,
     E'Hi {first_name}, just checking in! Have you had a chance to book your ReShape visit yet? We''d love to show you around: {book_link}',
     true),

    -- Step 6: Final email (7 days)
    (seq_id, 6, 'email', 604800,
     E'Last chance \u2014 your spot won''t wait forever',
     E'{first_name}, your spot is still open \u2014 but not for long.\n\nIt''s been a week since you applied. We''d love to help you start your transformation, but we can only hold spots for so long.\n\nThis is your final reminder \u2014 book your consult and let''s make it happen.\n\nBook your visit \u2192 {book_link}',
     true);
end $$;
