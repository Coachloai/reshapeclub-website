-- Track calendar event IDs so we can delete/update events on cancel/reschedule.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS calendar_event_url TEXT,
  ADD COLUMN IF NOT EXISTS calendar_provider TEXT;  -- 'icloud' | 'google'
