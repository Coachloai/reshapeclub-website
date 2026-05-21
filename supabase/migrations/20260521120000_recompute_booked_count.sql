-- ============================================================
-- Recompute booking_slots.booked_count from confirmed bookings.
--
-- Cancelling / no-showing a booking historically did not decrement
-- the slot's booked_count, so many slots showed "Full" forever even
-- though their only booking was cancelled. The Time Slots view then
-- showed those slots as Full with no prospect name (the prospect
-- column only lists confirmed bookings).
--
-- The dashboard cancel/no-show handler now decrements the slot, but
-- this one-off backfill fixes the existing drift so booked_count
-- reflects only currently-confirmed bookings.
-- ============================================================

update public.booking_slots s
   set booked_count = (
     select count(*)
     from public.bookings b
     where b.slot_id = s.id
       and b.status = 'confirmed'
   );
