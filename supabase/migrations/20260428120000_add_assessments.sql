-- ============================================================
-- ReShape Hormonal Assessment
-- Adds assessments + assessment_answers tables, plus a small
-- per-IP rate-limit table used by the Edge Functions.
-- Run via Supabase Studio SQL Editor (or `supabase db push`).
-- ============================================================

-- ── 1. assessments: one row per session (in-progress or completed) ──
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  lead_id uuid references public.leads(id) on delete cascade,
  started_at timestamptz not null default now(),
  email_captured_at timestamptz,
  completed_at timestamptz,
  primary_archetype text check (primary_archetype in (
    'stress_driven_plateau',
    'hormonal_shift',
    'metabolic_resistance',
    'compound_pattern'
  )),
  secondary_archetype text check (secondary_archetype in (
    'stress_driven_plateau',
    'hormonal_shift',
    'metabolic_resistance'
  )),
  hormone_scores jsonb,
  cluster_scores jsonb,
  flags jsonb not null default '[]'::jsonb,
  utm_source text,
  utm_campaign text,
  user_agent text,
  ip_country text
);

create index if not exists assessments_session_id_idx on public.assessments(session_id);
create index if not exists assessments_lead_id_idx on public.assessments(lead_id);
create index if not exists assessments_completed_at_idx on public.assessments(completed_at) where completed_at is not null;
create index if not exists assessments_archetype_idx on public.assessments(primary_archetype) where primary_archetype is not null;

-- ── 2. assessment_answers: upsert-friendly per (session, question) ──
create table if not exists public.assessment_answers (
  session_id uuid not null references public.assessments(session_id) on delete cascade,
  question_id text not null,
  answer_value text not null,
  answered_at timestamptz not null default now(),
  primary key (session_id, question_id)
);

-- ── 3. RLS: anon clients are fully denied; Edge Functions use service role ──
alter table public.assessments enable row level security;
alter table public.assessment_answers enable row level security;
-- (No policies = anon denied. Service role bypasses RLS by default.)

-- Revoke any default grants from anon/authenticated to be explicit.
revoke all on public.assessments from anon, authenticated;
revoke all on public.assessment_answers from anon, authenticated;
grant all on public.assessments to service_role;
grant all on public.assessment_answers to service_role;

-- ── 4. Rate limit table (fixed window per IP per bucket) ──
create table if not exists public.rate_limits (
  ip text not null,
  bucket text not null,
  request_count integer not null default 1,
  window_start timestamptz not null default now(),
  primary key (ip, bucket)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
grant all on public.rate_limits to service_role;

-- check_rate_limit returns true when the request is allowed, false when limited.
create or replace function public.check_rate_limit(
  p_ip text,
  p_bucket text,
  p_limit int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_limits (ip, bucket, request_count, window_start)
  values (p_ip, p_bucket, 1, now())
  on conflict (ip, bucket) do update
    set request_count = case
          when public.rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval then 1
          else public.rate_limits.request_count + 1
        end,
        window_start  = case
          when public.rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval then now()
          else public.rate_limits.window_start
        end
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

grant execute on function public.check_rate_limit(text, text, int, int) to service_role;
