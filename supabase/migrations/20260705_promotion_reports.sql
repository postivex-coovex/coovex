-- Promotion audit reports — shareable public links for cold outreach
create table if not exists promotion_reports (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  domain      text not null,
  report_json jsonb not null,
  prospect_email text,
  created_by  uuid references profiles(id) on delete set null,
  views       int not null default 0,
  created_at  timestamptz not null default now()
);

-- Public read — no auth required (prospect opens the link)
alter table promotion_reports enable row level security;

create policy "Public can read promotion reports"
  on promotion_reports for select
  using (true);

create policy "Admins can insert promotion reports"
  on promotion_reports for insert
  with check (auth.uid() = created_by);

create policy "Admins can update own reports"
  on promotion_reports for update
  using (auth.uid() = created_by);
