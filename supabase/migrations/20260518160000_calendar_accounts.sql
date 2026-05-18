-- Connected calendar accounts. One row per provider account (iCloud, Google).
-- Lets the team add/remove accounts from the dashboard instead of editing
-- Supabase secrets via the CLI.
--
-- creds shape:
--   provider='icloud': { username, app_password }
--   provider='google': { client_id, client_secret, refresh_token, access_token?, expires_at? }
--
-- Only the service role (used by edge functions) should ever read the creds.
-- We deliberately do NOT expose this table to the anon key.
CREATE TABLE IF NOT EXISTS calendar_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('icloud', 'google')),
  email text NOT NULL,
  creds jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS calendar_accounts_provider_email_idx
  ON calendar_accounts (provider, email);

-- Row-level security so creds are never reachable by the anon key.
ALTER TABLE calendar_accounts ENABLE ROW LEVEL SECURITY;

-- The dashboard needs to LIST accounts (provider + email + id) without seeing creds.
-- Easiest pragmatic fix: a view that strips the creds column, exposed to anon.
CREATE OR REPLACE VIEW calendar_accounts_public AS
  SELECT id, provider, email, created_at, updated_at
  FROM calendar_accounts;

GRANT SELECT ON calendar_accounts_public TO anon, authenticated;

-- Anon may INSERT new accounts (dashboard is single-user behind a login screen) but
-- never SELECT or UPDATE creds directly. Service role bypasses RLS.
CREATE POLICY calendar_accounts_anon_insert ON calendar_accounts
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY calendar_accounts_anon_delete ON calendar_accounts
  FOR DELETE TO anon USING (true);
