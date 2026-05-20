-- ============================================================
-- WhatsApp broadcasts need a Twilio Content template SID to reach
-- recipients outside the 24h conversation window (cold prospects).
--
-- The dashboard already makes the user pick an approved template and
-- send_broadcast receives it, but message_queue had nowhere to store
-- it — so the WhatsApp sender always fell back to free-form text and
-- Twilio rejected it. The sender already reads these per-row:
--   sendWhatsApp(msg.lead_phone, msg.body, msg.template_sid, msg.template_vars)
--
-- Add the columns so a queued broadcast row can carry its template.
-- ============================================================

alter table public.message_queue
  add column if not exists template_sid  text,
  add column if not exists template_vars jsonb;
