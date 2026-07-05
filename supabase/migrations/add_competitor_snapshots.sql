-- Daily snapshots for competitor intelligence score trend chart
create table if not exists competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  competitor_id uuid references competitors(id) on delete cascade,
  intelligence_score integer not null default 0,
  threat_level text,
  google_rating numeric(3,1),
  recorded_date date not null default current_date,
  created_at timestamptz default now(),
  constraint competitor_snapshots_unique unique (competitor_id, recorded_date)
);

-- Daily snapshots for user's business health score
create table if not exists business_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  health_score integer not null default 0,
  recorded_date date not null default current_date,
  created_at timestamptz default now(),
  constraint business_snapshots_unique unique (business_id, recorded_date)
);

-- Enable RLS
alter table competitor_snapshots enable row level security;
alter table business_snapshots enable row level security;

create policy "Users see own competitor snapshots" on competitor_snapshots
  for all using (
    business_id in (
      select b.id from businesses b
      join profiles p on p.current_workspace_id = b.workspace_id
      where p.id = auth.uid()
    )
  );

create policy "Users see own business snapshots" on business_snapshots
  for all using (
    business_id in (
      select b.id from businesses b
      join profiles p on p.current_workspace_id = b.workspace_id
      where p.id = auth.uid()
    )
  );
