-- Backfill all existing leads.phone values to E.164 (+44...) format.
--
-- Why: assessment-session and the main site form previously stored phones
-- in mixed formats (07..., +44..., 44...). The booking_confirmed SMS sequence
-- and any downstream WhatsApp tooling needs E.164 to send. This one-time
-- migration converts the existing rows. Going forward, assessment-session
-- normalises on insert via toE164UK() (see edge function code).
--
-- Conversion rules (defaults to UK):
--   "07700900123"     → "+447700900123"
--   "447700900123"    → "+447700900123"
--   "00447700900123"  → "+447700900123"
--   "+447700900123"   → "+447700900123" (untouched)
--   anything else → untouched (defensive: preserves international numbers)
--
-- Re-run safe: every branch is idempotent once a number is already in E.164.

update public.leads
set phone = case
    -- Already E.164 — leave alone
    when phone like '+%'                                         then phone
    -- International dial prefix: 0044... → +44...
    when phone ~ '^0044\d+$'                                     then '+' || substring(phone from 3)
    -- Country code without +: 44... → +44...
    when phone ~ '^44\d{9,11}$'                                  then '+' || phone
    -- UK trunk-prefixed (any 0-leading, 10–11 chars): 07700... → +447700...
    when phone ~ '^0\d{9,10}$'                                   then '+44' || substring(phone from 2)
    -- 10-digit no prefix: assume UK
    when phone ~ '^\d{10}$'                                      then '+44' || phone
    -- Otherwise leave it (could be a non-UK number we shouldn't touch)
    else phone
  end
where phone is not null
  and phone <> ''
  and phone not like '+%';
