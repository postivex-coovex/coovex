-- ── Marketing Plans ────────────────────────────────────────────────────────────
create table if not exists marketing_plans (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id  uuid not null references businesses(id) on delete cascade,
  goal         text not null,
  plan_json    jsonb not null,
  actions_done jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(business_id, goal)
);
create index if not exists idx_marketing_plans_business on marketing_plans(business_id);

-- ── Launch Tracker Platforms ───────────────────────────────────────────────────
create table if not exists launch_tracker_platforms (
  id          uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id  uuid not null references businesses(id) on delete cascade,
  platform_id  text not null,
  status       text not null default 'not_started',
  url          text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(business_id, platform_id)
);

-- ── Execution Plans (Business Plan) ────────────────────────────────────────────
create table if not exists execution_plans (
  id          uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id  uuid not null references businesses(id) on delete cascade,
  product      text not null,
  plan_json    jsonb not null,
  steps_done   jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(business_id, product)
);
create index if not exists idx_execution_plans_business on execution_plans(business_id);

-- ── Goals (dedicated table, replaces businesses.integrations.__goals) ──────────
create table if not exists goals (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  business_id   uuid not null references businesses(id) on delete cascade,
  title         text not null,
  category      text not null,
  period        text not null,
  target        numeric(14,2) not null,
  unit          text not null,
  due_date      date,
  current_value numeric(14,2) not null default 0,
  custom_current numeric(14,2),
  auto_tracked  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_goals_business on goals(business_id);

-- ── RLS Policies ───────────────────────────────────────────────────────────────
alter table marketing_plans          enable row level security;
alter table launch_tracker_platforms enable row level security;
alter table execution_plans          enable row level security;
alter table goals                    enable row level security;

-- marketing_plans
drop policy if exists "workspace members can manage marketing_plans" on marketing_plans;
create policy "workspace members can manage marketing_plans"
  on marketing_plans for all using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- launch_tracker_platforms
drop policy if exists "workspace members can manage launch_tracker_platforms" on launch_tracker_platforms;
create policy "workspace members can manage launch_tracker_platforms"
  on launch_tracker_platforms for all using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- execution_plans
drop policy if exists "workspace members can manage execution_plans" on execution_plans;
create policy "workspace members can manage execution_plans"
  on execution_plans for all using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- goals
drop policy if exists "workspace members can manage goals" on goals;
create policy "workspace members can manage goals"
  on goals for all using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );
