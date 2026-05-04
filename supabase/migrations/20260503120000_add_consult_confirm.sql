-- ============================================================
-- Consult-confirm flow
--
-- Adds confirmation tracking to bookings + a transformation_members
-- table that powers the pattern-matched gallery on the confirm page
-- (reshape.fit/confirm/).
-- ============================================================

-- 1. Bookings: confirmation columns + assessment linkage.
alter table public.bookings
  add column if not exists confirmed_at           timestamptz,
  add column if not exists relate_to_members      text[]   default '{}',
  add column if not exists pre_consult_note       text,
  add column if not exists confirm_token          uuid     default gen_random_uuid(),
  add column if not exists assessment_session_id  uuid;

-- Backfill confirm_token on any pre-existing rows.
update public.bookings
   set confirm_token = gen_random_uuid()
 where confirm_token is null;

create index if not exists idx_bookings_confirm_token
  on public.bookings(confirm_token);
create index if not exists idx_bookings_session
  on public.bookings(assessment_session_id);

-- 2. Transformation members — pattern-tagged gallery rows.
create table if not exists public.transformation_members (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  image_url       text        not null,
  starting_point  text,
  goal            text,
  pattern_tag     text        not null check (pattern_tag in (
                    'stress_driven_plateau',
                    'hormonal_shift',
                    'metabolic_resistance',
                    'compound_pattern'
                  )),
  display_order   int         not null default 100,
  active          boolean     not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists idx_tm_pattern_active
  on public.transformation_members(pattern_tag, active, display_order);

-- 3. RLS: anon can read active gallery rows for the confirm page.
alter table public.transformation_members enable row level security;

drop policy if exists "anon_read_active_members" on public.transformation_members;
create policy "anon_read_active_members"
  on public.transformation_members for select
  to anon, authenticated
  using (active = true);

grant select on public.transformation_members to anon, authenticated;
