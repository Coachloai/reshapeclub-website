-- Add meeting_type to onboarding (tko = first meeting, nutrition = second meeting)
ALTER TABLE onboarding ADD COLUMN IF NOT EXISTS meeting_type text DEFAULT 'tko';
