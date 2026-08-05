-- Add confirmation-gated chase columns
-- automation_steps: skip_if_confirmed / skip_if_not_confirmed flags
-- message_queue: booking_id so the queue processor can check confirmed_at

-- 1. automation_steps: two boolean flags
ALTER TABLE automation_steps
  ADD COLUMN IF NOT EXISTS skip_if_confirmed     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_if_not_confirmed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN automation_steps.skip_if_confirmed IS
  'When true, skip this step if the booking already has confirmed_at set (chase messages).';
COMMENT ON COLUMN automation_steps.skip_if_not_confirmed IS
  'When true, skip this step if the booking has NOT been confirmed (day-of reminders).';

-- 2. automation_steps: template support for WhatsApp Content Templates
ALTER TABLE automation_steps
  ADD COLUMN IF NOT EXISTS template_sid  TEXT,
  ADD COLUMN IF NOT EXISTS template_vars JSONB;

-- 3. message_queue: booking_id + the two flags copied from the step
ALTER TABLE message_queue
  ADD COLUMN IF NOT EXISTS booking_id             UUID,
  ADD COLUMN IF NOT EXISTS skip_if_confirmed      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_if_not_confirmed  BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_mq_booking ON message_queue(booking_id);
