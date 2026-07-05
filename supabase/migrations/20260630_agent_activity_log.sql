-- Agent Activity Log: tracks every action taken from Agent Inbox
-- (user approve, bulk execute, or AI auto-execute)

create table if not exists agent_activity_log (
  id               uuid        primary key default gen_random_uuid(),
  workspace_id     uuid        not null references workspaces(id) on delete cascade,
  business_id      uuid        references businesses(id) on delete cascade,
  signal_id        uuid        references agent_signals(id) on delete set null,
  user_id          uuid        references profiles(id) on delete set null,
  action_type      text        not null,
  executed_by      text        not null default 'user', -- 'agent' | 'user' | 'user_bulk'
  executed_at      timestamptz not null default now(),
  action_data_json jsonb       not null default '{}',
  result_json      jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists agent_activity_log_workspace_idx    on agent_activity_log(workspace_id);
create index if not exists agent_activity_log_executed_at_idx  on agent_activity_log(executed_at desc);
create index if not exists agent_activity_log_signal_idx       on agent_activity_log(signal_id);

-- RLS: users can only see their own workspace logs
alter table agent_activity_log enable row level security;

create policy "workspace members can view activity log"
  on agent_activity_log for select
  using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
      union
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- Service role bypasses RLS for writes (execute/bulk routes use service client)
