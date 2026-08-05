-- Add cancel_reason to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancel_reason text DEFAULT '';
