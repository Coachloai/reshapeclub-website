-- Calendar routing per appointment type (Calendly-style).
-- calendar_targets:    where to WRITE the booking (e.g. ["icloud","google:primary"])
-- conflict_calendars:  which calendars to CHECK for busy times when generating slots
-- Identifier scheme:
--   "icloud"                -> primary iCloud calendar
--   "google:<calendarId>"   -> a specific Google calendar (e.g. google:primary, google:abc@group.calendar.google.com)
ALTER TABLE appointment_types
  ADD COLUMN IF NOT EXISTS calendar_targets   jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS conflict_calendars jsonb NOT NULL DEFAULT '[]'::jsonb;
