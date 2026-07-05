-- Integration Service Inquiries table
create table if not exists integration_inquiries (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  name            text not null,
  email           text not null,
  service_type    text not null,
  description     text not null,
  budget          text,
  business_name   text,
  workspace_id    uuid references workspaces(id) on delete set null,
  status          text not null default 'new'
                    check (status in ('new','in_review','proposal_sent','closed')),
  proposal_sent_at timestamptz
);

-- Only admins (via service role / RLS bypass) should read all rows
-- Users cannot read other users' inquiries
alter table integration_inquiries enable row level security;

-- Admins access via service role key (bypasses RLS) — no extra policy needed
-- Users can insert their own inquiry
create policy "Users can submit inquiries"
  on integration_inquiries for insert
  to authenticated
  with check (true);
