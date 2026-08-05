-- Add online_portal column to consults and consult_contracts
ALTER TABLE consults ADD COLUMN IF NOT EXISTS online_portal boolean DEFAULT false;
ALTER TABLE consult_contracts ADD COLUMN IF NOT EXISTS online_portal boolean DEFAULT false;

-- Add consult_type column for distinguishing consults vs renewals
ALTER TABLE consults ADD COLUMN IF NOT EXISTS consult_type text DEFAULT 'consult';
