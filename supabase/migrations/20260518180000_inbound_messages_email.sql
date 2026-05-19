-- Extend inbound_messages so it can hold email rows too, not just SMS/WhatsApp.
--
-- Email rows leave from_phone / to_phone NULL and populate from_email / to_email
-- + subject instead.

ALTER TABLE public.inbound_messages
  DROP CONSTRAINT IF EXISTS inbound_messages_channel_check;

ALTER TABLE public.inbound_messages
  ADD CONSTRAINT inbound_messages_channel_check
  CHECK (channel IN ('sms', 'whatsapp', 'email'));

ALTER TABLE public.inbound_messages
  ALTER COLUMN from_phone DROP NOT NULL,
  ALTER COLUMN to_phone   DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS from_email text,
  ADD COLUMN IF NOT EXISTS to_email   text,
  ADD COLUMN IF NOT EXISTS subject    text,
  ADD COLUMN IF NOT EXISTS html_body  text;

CREATE INDEX IF NOT EXISTS inbound_messages_from_email_created_idx
  ON public.inbound_messages (from_email, created_at DESC)
  WHERE from_email IS NOT NULL;

-- Either a phone OR an email must be present (otherwise the conversation has
-- no addressable handle).
ALTER TABLE public.inbound_messages
  DROP CONSTRAINT IF EXISTS inbound_messages_has_handle;

ALTER TABLE public.inbound_messages
  ADD CONSTRAINT inbound_messages_has_handle
  CHECK (from_phone IS NOT NULL OR from_email IS NOT NULL);
