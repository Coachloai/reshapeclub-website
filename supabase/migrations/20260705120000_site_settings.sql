-- Site-wide settings (singleton row)
create table if not exists site_settings (
  id text primary key default 'global',
  waitlist_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Seed the singleton row
insert into site_settings (id, waitlist_enabled) values ('global', false)
on conflict (id) do nothing;

-- Allow anon to read (public pages need to check waitlist status)
grant select on site_settings to anon;

-- Allow authenticated to update (dashboard toggle)
grant update on site_settings to authenticated;

-- RLS
alter table site_settings enable row level security;

create policy "Anyone can read site settings"
  on site_settings for select using (true);

create policy "Authenticated users can update site settings"
  on site_settings for update using (true);
