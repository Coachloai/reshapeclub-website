-- Global calendar settings (singleton row keyed on id='global').
-- Mirrors Calendly's "Calendar settings" page:
--   conflict_calendars       — array of calendar identifiers used to hide busy slots
--                              (e.g. ["icloud:Work","icloud:Home","google:primary"])
--   default_target_calendar  — single calendar id where new bookings are written
--   include_buffers          — when true, the target calendar's buffer events also block availability
--
-- Per-appointment-type calendar_targets / conflict_calendars on appointment_types
-- are superseded by this table and no longer read by the application (kept on the
-- schema for now in case we ever bring back per-type overrides).
CREATE TABLE IF NOT EXISTS calendar_settings (
  id text PRIMARY KEY DEFAULT 'global',
  conflict_calendars jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_target_calendar text,
  include_buffers boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO calendar_settings (id) VALUES ('global')
  ON CONFLICT (id) DO NOTHING;
