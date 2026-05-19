-- ============================================================
-- On-demand messaging: per-channel consent tracking, audit log,
-- broadcast records, and a queue that accepts WhatsApp.
--
-- - Adds email/sms/wa consent state to leads (status + when + source).
-- - Backfills the existing ~1,200 leads as opted-in for all three
--   channels with source 'legacy_form_submission' (consent already
--   captured via the previous channel; flagged 19 May 2026).
-- - Generates a per-lead consent_token used in unsubscribe links.
-- - New consent_audit_log for every grant/revoke/confirm action.
-- - New message_sends row per broadcast, linked from message_queue
--   via send_id so the dashboard can show per-send delivery stats.
-- - Expands message_queue.channel CHECK to allow 'whatsapp'.
-- - Trigger keeps consent_at + consent_source in sync on insert.
-- ============================================================

-- ── 1. Consent columns on leads ──
alter table public.leads
  add column if not exists email_consent_status text default 'opted_in'
    check (email_consent_status in ('opted_in','opted_out','pending')),
  add column if not exists email_consent_at     timestamptz,
  add column if not exists email_consent_source text,
  add column if not exists sms_consent_status   text default 'opted_in'
    check (sms_consent_status   in ('opted_in','opted_out','pending')),
  add column if not exists sms_consent_at       timestamptz,
  add column if not exists sms_consent_source   text,
  add column if not exists wa_consent_status    text default 'opted_in'
    check (wa_consent_status    in ('opted_in','opted_out','pending')),
  add column if not exists wa_consent_at        timestamptz,
  add column if not exists wa_consent_source    text,
  add column if not exists consent_token        text;

-- Unique token so /unsubscribe?token=xxx resolves to exactly one lead.
create unique index if not exists idx_leads_consent_token
  on public.leads(consent_token)
  where consent_token is not null;

create index if not exists idx_leads_email_consent on public.leads(email_consent_status);
create index if not exists idx_leads_sms_consent   on public.leads(sms_consent_status);
create index if not exists idx_leads_wa_consent    on public.leads(wa_consent_status);

-- Backfill: existing leads have consent via the previous capture channel.
update public.leads
   set email_consent_at     = coalesce(email_consent_at, created_at, now()),
       email_consent_source = coalesce(email_consent_source, 'legacy_form_submission'),
       sms_consent_at       = coalesce(sms_consent_at,   created_at, now()),
       sms_consent_source   = coalesce(sms_consent_source,   'legacy_form_submission'),
       wa_consent_at        = coalesce(wa_consent_at,    created_at, now()),
       wa_consent_source    = coalesce(wa_consent_source,    'legacy_form_submission'),
       consent_token        = coalesce(consent_token, replace(gen_random_uuid()::text, '-', ''))
 where consent_token is null
    or email_consent_at is null
    or sms_consent_at   is null
    or wa_consent_at    is null;

-- ── 2. Trigger so new leads get consent timestamps/source for free ──
create or replace function public.set_lead_consent_defaults()
returns trigger language plpgsql as $$
begin
  if new.consent_token is null then
    new.consent_token := replace(gen_random_uuid()::text, '-', '');
  end if;
  if new.email_consent_status = 'opted_in' and new.email_consent_at is null then
    new.email_consent_at     := coalesce(new.created_at, now());
    new.email_consent_source := coalesce(new.email_consent_source, new.form_name);
  end if;
  if new.sms_consent_status = 'opted_in' and new.sms_consent_at is null then
    new.sms_consent_at       := coalesce(new.created_at, now());
    new.sms_consent_source   := coalesce(new.sms_consent_source, new.form_name);
  end if;
  if new.wa_consent_status = 'opted_in' and new.wa_consent_at is null then
    new.wa_consent_at        := coalesce(new.created_at, now());
    new.wa_consent_source    := coalesce(new.wa_consent_source, new.form_name);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_consent_defaults on public.leads;
create trigger trg_leads_consent_defaults
  before insert on public.leads
  for each row execute function public.set_lead_consent_defaults();

-- ── 3. Consent audit log ──
create table if not exists public.consent_audit_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  lead_id     uuid references public.leads(id) on delete cascade,
  channel     text not null check (channel in ('email','sms','whatsapp')),
  action      text not null check (action  in ('granted','revoked','confirmed')),
  source      text,
  ip          text,
  user_agent  text,
  notes       text
);
create index if not exists idx_cal_lead    on public.consent_audit_log(lead_id);
create index if not exists idx_cal_channel on public.consent_audit_log(channel);

alter table public.consent_audit_log enable row level security;
drop policy if exists cal_read   on public.consent_audit_log;
drop policy if exists cal_insert on public.consent_audit_log;
create policy cal_read   on public.consent_audit_log for select using (true);
create policy cal_insert on public.consent_audit_log for insert with check (true);
grant select, insert on public.consent_audit_log to anon, authenticated, service_role;

-- ── 4. Broadcast (one row per send-to-many) ──
create table if not exists public.message_sends (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  created_by      text,
  channel         text not null check (channel in ('email','sms','whatsapp')),
  audience_filter jsonb not null default '{}'::jsonb,
  audience_size   integer not null default 0,
  subject         text,
  body            text,
  template_sid    text,
  template_vars   jsonb,
  scheduled_at    timestamptz not null default now(),
  status          text not null default 'queued'
    check (status in ('queued','sending','sent','partial','failed','cancelled')),
  sent_count      integer not null default 0,
  failed_count    integer not null default 0,
  notes           text
);
create index if not exists idx_ms_created_at on public.message_sends(created_at desc);
create index if not exists idx_ms_status     on public.message_sends(status);

alter table public.message_sends enable row level security;
drop policy if exists ms_read   on public.message_sends;
drop policy if exists ms_insert on public.message_sends;
drop policy if exists ms_update on public.message_sends;
create policy ms_read   on public.message_sends for select using (true);
create policy ms_insert on public.message_sends for insert with check (true);
create policy ms_update on public.message_sends for update using (true);
grant select, insert, update on public.message_sends to anon, authenticated, service_role;

-- ── 5. Wire message_queue to message_sends + accept whatsapp ──
alter table public.message_queue
  add column if not exists send_id uuid references public.message_sends(id) on delete set null,
  add column if not exists consent_token text;

create index if not exists idx_mq_send_id on public.message_queue(send_id);

-- The original CHECK constraint only allows ('email','sms'); broaden it.
alter table public.message_queue drop constraint if exists message_queue_channel_check;
alter table public.message_queue
  add constraint message_queue_channel_check
  check (channel in ('email','sms','whatsapp'));

-- ── 6. Keep message_sends sent_count/failed_count in sync ──
create or replace function public.update_send_counters()
returns trigger language plpgsql as $$
begin
  if new.send_id is null then return new; end if;
  if (tg_op = 'UPDATE' and new.status = old.status) then return new; end if;
  if new.status = 'sent' and (tg_op = 'INSERT' or old.status <> 'sent') then
    update public.message_sends
       set sent_count = sent_count + 1,
           status = case
             when sent_count + 1 + failed_count >= audience_size then
               case when failed_count > 0 then 'partial' else 'sent' end
             else 'sending'
           end
     where id = new.send_id;
  elsif new.status = 'failed' and (tg_op = 'INSERT' or old.status <> 'failed') then
    update public.message_sends
       set failed_count = failed_count + 1,
           status = case
             when sent_count + failed_count + 1 >= audience_size then
               case when sent_count > 0 then 'partial' else 'failed' end
             else 'sending'
           end
     where id = new.send_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mq_update_send_counters on public.message_queue;
create trigger trg_mq_update_send_counters
  after insert or update of status on public.message_queue
  for each row execute function public.update_send_counters();
