-- ── AI Credit System ────────────────────────────────────────────────────────

-- Add credit columns to workspaces
alter table workspaces
  add column if not exists ai_credits_balance  integer not null default 0,
  add column if not exists ai_credits_monthly  integer not null default 100,
  add column if not exists credits_reset_at    timestamptz default (now() + interval '1 month');

-- Credit transaction log
create table if not exists credit_transactions (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  amount        integer not null,           -- positive = add, negative = deduct
  type          text not null check (type in ('monthly_refresh','purchase','usage','bonus','refund')),
  feature       text,                       -- which feature consumed credits
  description   text,
  balance_after integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_credit_tx_workspace on credit_transactions(workspace_id, created_at desc);

alter table credit_transactions enable row level security;

drop policy if exists "workspace members can view credit_transactions" on credit_transactions;
create policy "workspace members can view credit_transactions"
  on credit_transactions for select using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- Seed initial credits based on current plan
update workspaces set
  ai_credits_balance = case plan
    when 'starter'    then 500
    when 'growth'     then 2000
    when 'scale'      then 6000
    when 'agency'     then 20000
    when 'enterprise' then 50000
    else 100  -- free trial
  end,
  ai_credits_monthly = case plan
    when 'starter'    then 500
    when 'growth'     then 2000
    when 'scale'      then 6000
    when 'agency'     then 20000
    when 'enterprise' then 50000
    else 100
  end
where ai_credits_balance = 0;

-- Function: atomic credit deduction (returns new balance or -1 if insufficient)
create or replace function deduct_ai_credits(
  p_workspace_id  uuid,
  p_amount        integer,
  p_feature       text,
  p_description   text default null
) returns integer language plpgsql security definer as $$
declare
  v_balance integer;
  v_new     integer;
begin
  select ai_credits_balance into v_balance
  from workspaces where id = p_workspace_id for update;

  if v_balance is null then return -1; end if;
  if v_balance < p_amount then return -1; end if;

  v_new := v_balance - p_amount;
  update workspaces set ai_credits_balance = v_new where id = p_workspace_id;

  insert into credit_transactions(workspace_id, amount, type, feature, description, balance_after)
  values (p_workspace_id, -p_amount, 'usage', p_feature, p_description, v_new);

  return v_new;
end;
$$;

-- Function: add credits (purchase or refresh)
create or replace function add_ai_credits(
  p_workspace_id uuid,
  p_amount       integer,
  p_type         text,
  p_description  text default null
) returns integer language plpgsql security definer as $$
declare v_new integer;
begin
  update workspaces
    set ai_credits_balance = ai_credits_balance + p_amount
  where id = p_workspace_id
  returning ai_credits_balance into v_new;

  insert into credit_transactions(workspace_id, amount, type, description, balance_after)
  values (p_workspace_id, p_amount, p_type, p_description, v_new);

  return v_new;
end;
$$;
