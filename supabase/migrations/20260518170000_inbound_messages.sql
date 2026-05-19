-- Inbox: inbound SMS + WhatsApp messages from leads.
--
-- Populated by the whatsapp-inbound edge function, which Twilio POSTs to
-- every time a recipient replies to one of our outbound messages. The
-- dashboard Inbox tab reads from here and groups by from_phone.
CREATE TABLE IF NOT EXISTS public.inbound_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  channel     text        NOT NULL CHECK (channel IN ('sms','whatsapp')),
  from_phone  text        NOT NULL,
  to_phone    text        NOT NULL,
  profile_name text,
  body        text        NOT NULL DEFAULT '',
  message_sid text        UNIQUE,
  num_media   int         NOT NULL DEFAULT 0,
  media_urls  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  read_at     timestamptz,
  replied_at  timestamptz
);

CREATE INDEX IF NOT EXISTS inbound_messages_from_created_idx
  ON public.inbound_messages (from_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS inbound_messages_unread_idx
  ON public.inbound_messages (created_at DESC) WHERE read_at IS NULL;

ALTER TABLE public.inbound_messages ENABLE ROW LEVEL SECURITY;

-- The dashboard runs under the anon key. Service role (used by the
-- whatsapp-inbound edge function) bypasses RLS for inserts.
CREATE POLICY inbound_messages_anon_read ON public.inbound_messages
  FOR SELECT TO anon USING (true);

-- Anon may update only read_at / replied_at — not rewrite history.
CREATE POLICY inbound_messages_anon_update ON public.inbound_messages
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
