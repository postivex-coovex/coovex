-- ── Orchestration Engine Tables ───────────────────────────────────────────
-- Run this in Supabase SQL Editor

-- 1. business_events — central event bus, logs every significant business event
create table if not exists business_events (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null,
  event_type   text        not null,  -- e.g. 'competitor.price_threat', 'lead.score_drop'
  entity_type  text,                  -- 'competitor_insight', 'lead', 'goal'
  entity_id    text,                  -- ID of the triggering entity
  event_data_json jsonb    not null default '{}',
  processed    boolean     not null default false,
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists business_events_workspace_idx on business_events(workspace_id, processed, created_at desc);
alter table business_events enable row level security;
-- Service role only — API routes handle all access
create policy "service_role_only_events" on business_events using (false);

-- 2. orchestration_rules — custom user-defined rules (built-in rules live in code)
create table if not exists orchestration_rules (
  id                     uuid    primary key default gen_random_uuid(),
  workspace_id           uuid    not null,
  name                   text    not null,
  description            text,
  trigger_type           text    not null,  -- event_type to match
  trigger_condition_json jsonb   not null default '{}',
  action_chain_json      jsonb   not null default '[]',
  confidence_threshold   integer not null default 70,
  enabled                boolean not null default true,
  is_builtin             boolean not null default false,
  created_at             timestamptz not null default now()
);
create index if not exists orchestration_rules_workspace_idx on orchestration_rules(workspace_id, enabled);
alter table orchestration_rules enable row level security;
create policy "service_role_only_rules" on orchestration_rules using (false);

-- 3. orchestration_runs — full audit trail of every chain execution
create table if not exists orchestration_runs (
  id                    uuid    primary key default gen_random_uuid(),
  workspace_id          uuid    not null,
  rule_id               text    not null,   -- builtin rule id or uuid from orchestration_rules
  rule_name             text    not null,
  triggered_by          text    not null,   -- 'competitor_insight:uuid', 'lead:uuid', 'goal:uuid'
  event_type            text    not null,
  event_data_json       jsonb   default '{}',
  actions_executed_json jsonb   not null default '[]',
  chain_id              text    not null,   -- groups the agent_signals created by this run
  status                text    not null default 'completed',  -- completed | partial | failed
  signals_created       integer not null default 0,
  created_at            timestamptz not null default now()
);
create index if not exists orchestration_runs_workspace_idx on orchestration_runs(workspace_id, created_at desc);
create index if not exists orchestration_runs_triggered_idx on orchestration_runs(rule_id, triggered_by, created_at desc);
alter table orchestration_runs enable row level security;
create policy "service_role_only_runs" on orchestration_runs using (false);
