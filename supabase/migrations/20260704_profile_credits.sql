-- Move AI credits balance from workspaces to profiles
-- Credits are per-user/account; per-business usage is tracked via credit_transactions.workspace_id

-- 1. Add balance column to profiles
alter table profiles
  add column if not exists ai_credits_balance integer not null default 0;

-- 2. Add user_id to credit_transactions for profile-level queries
alter table credit_transactions
  add column if not exists user_id uuid references profiles(id) on delete set null;

create index if not exists idx_credit_tx_user on credit_transactions(user_id, created_at desc);

-- 3. Migrate existing balances: profile gets the sum across all their workspaces
update profiles p
set ai_credits_balance = coalesce((
  select sum(w.ai_credits_balance)
  from workspaces w
  where w.owner_id = p.id
), 0);

-- 4. Backfill user_id on existing transactions
update credit_transactions ct
set user_id = w.owner_id
from workspaces w
where ct.workspace_id = w.id
  and ct.user_id is null;

-- 5. Rewrite deduct_ai_credits: deducts from owner profile, logs workspace
create or replace function deduct_ai_credits(
  p_workspace_id  uuid,
  p_amount        integer,
  p_feature       text,
  p_description   text default null
) returns integer language plpgsql security definer as $$
declare
  v_owner_id  uuid;
  v_balance   integer;
  v_new       integer;
begin
  select owner_id into v_owner_id
  from workspaces where id = p_workspace_id;

  if v_owner_id is null then return -1; end if;

  select ai_credits_balance into v_balance
  from profiles where id = v_owner_id for update;

  if v_balance is null or v_balance < p_amount then return -1; end if;

  v_new := v_balance - p_amount;
  update profiles set ai_credits_balance = v_new where id = v_owner_id;

  insert into credit_transactions(workspace_id, user_id, amount, type, feature, description, balance_after)
  values (p_workspace_id, v_owner_id, -p_amount, 'usage', p_feature, coalesce(p_description, p_feature), v_new);

  return v_new;
end;
$$;

-- 6. Rewrite add_ai_credits: adds to owner profile
create or replace function add_ai_credits(
  p_workspace_id uuid,
  p_amount       integer,
  p_type         text,
  p_description  text default null
) returns integer language plpgsql security definer as $$
declare
  v_owner_id uuid;
  v_new      integer;
begin
  select owner_id into v_owner_id
  from workspaces where id = p_workspace_id;

  if v_owner_id is null then return 0; end if;

  update profiles
    set ai_credits_balance = ai_credits_balance + p_amount
  where id = v_owner_id
  returning ai_credits_balance into v_new;

  insert into credit_transactions(workspace_id, user_id, amount, type, description, balance_after)
  values (p_workspace_id, v_owner_id, p_amount, p_type, coalesce(p_description, p_type), v_new);

  return v_new;
end;
$$;
