-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ─── ENUMS ────────────────────────────────────────────────────────────────────

create type user_role as enum ('superadmin','owner','admin','manager','creator','sales','viewer','client');
create type plan_type as enum ('starter','growth','scale','agency','enterprise');
create type billing_status as enum ('active','trialing','past_due','canceled');
create type integration_type as enum (
  'linkedin','facebook','instagram','tiktok',
  'google_ads','google_analytics','google_mybusiness','google_search_console',
  'hubspot','salesforce','zoho','pipedrive','monday','notion',
  'quickbooks','xero','odoo','sap','netsuite','dynamics365',
  'shopify','woocommerce',
  'mailchimp','activecampaign','sendgrid','klaviyo','brevo',
  'trustpilot','g2','zapier','make','wordpress'
);
create type integration_status as enum ('connected','disconnected','error','expired');
create type post_channel as enum ('linkedin','facebook','instagram','tiktok','wordpress');
create type post_status as enum ('draft','pending_approval','scheduled','published','failed');
create type lead_stage as enum ('new','contacted','qualified','proposal_sent','won','lost');
create type lead_source as enum ('website_form','linkedin','facebook','google_ads','referral','manual','email','other');
create type activity_type as enum ('email_sent','email_opened','link_clicked','form_submitted','call','meeting','note','stage_change','score_change','ad_click');
create type audit_type as enum ('website','linkedin','facebook','full');
create type signal_type as enum ('urgent','warning','opportunity','done','insight');
create type signal_action_type as enum ('approve_post','respond_review','view_lead','view_report','open_url','open_chat','none');
create type review_platform as enum ('google','trustpilot','g2','capterra','facebook','tripadvisor');
create type review_status as enum ('new','responded','flagged','ignored');
create type agent_job_type as enum (
  'website_audit','linkedin_audit','facebook_audit','full_audit',
  'social_pull','competitor_check','lead_score','daily_brief',
  'trend_feed','review_check','email_send','post_publish'
);
create type agent_job_status as enum ('queued','running','done','failed');
create type business_size as enum ('1','2-10','11-50','51-200','201-500','500+');
create type target_customer as enum ('b2b','b2c','both');

-- ─── WORKSPACES ───────────────────────────────────────────────────────────────

create table workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid not null,
  plan plan_type not null default 'starter',
  white_label_config jsonb,
  custom_domain text unique,
  billing_status billing_status not null default 'trialing',
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── WORKSPACE MEMBERS ────────────────────────────────────────────────────────

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role user_role not null default 'viewer',
  invited_by uuid references auth.users(id),
  joined_at timestamptz default now(),
  primary key (workspace_id, user_id)
);

-- ─── USER PROFILES ────────────────────────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  language text not null default 'en',
  timezone text not null default 'UTC',
  onboarding_completed boolean not null default false,
  current_workspace_id uuid references workspaces(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── BUSINESSES ───────────────────────────────────────────────────────────────

create table businesses (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  industry text not null,
  size business_size not null default '2-10',
  website_url text,
  description text,
  target_customer target_customer not null default 'b2b',
  country text not null default 'US',
  logo_url text,
  health_score integer not null default 0 check (health_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── INTEGRATIONS ─────────────────────────────────────────────────────────────

create table integrations (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  type integration_type not null,
  status integration_status not null default 'disconnected',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  external_id text,
  meta_json jsonb,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, type)
);

-- ─── POSTS ────────────────────────────────────────────────────────────────────

create table posts (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  channel post_channel not null,
  content text not null,
  media_urls text[],
  status post_status not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  external_post_id text,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  campaign_id uuid,
  performance_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_business_status_idx on posts (business_id, status);
create index posts_scheduled_idx on posts (scheduled_at) where status = 'scheduled';

-- ─── LEADS ────────────────────────────────────────────────────────────────────

create table leads (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  job_title text,
  source lead_source not null default 'manual',
  score integer not null default 0 check (score between 0 and 100),
  stage lead_stage not null default 'new',
  assigned_to uuid references auth.users(id),
  tags text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_business_stage_idx on leads (business_id, stage);
create index leads_score_idx on leads (business_id, score desc);

create table lead_activities (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  type activity_type not null,
  data_json jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index lead_activities_lead_idx on lead_activities (lead_id, created_at desc);

-- ─── DEALS ────────────────────────────────────────────────────────────────────

create table deals (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  value numeric(12,2) not null default 0,
  currency text not null default 'USD',
  close_date date,
  probability integer not null default 50 check (probability between 0 and 100),
  status text not null default 'open' check (status in ('open','won','lost')),
  crm_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── AUDITS ───────────────────────────────────────────────────────────────────

create table audits (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  type audit_type not null,
  score integer not null check (score between 0 and 100),
  report_json jsonb not null,
  created_at timestamptz not null default now()
);

create index audits_business_type_idx on audits (business_id, type, created_at desc);

-- ─── COMPETITORS ──────────────────────────────────────────────────────────────

create table competitors (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  website text,
  linkedin_url text,
  facebook_url text,
  added_at timestamptz not null default now()
);

create table competitor_activity (
  id uuid primary key default uuid_generate_v4(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  type text not null,
  data_json jsonb,
  detected_at timestamptz not null default now()
);

-- ─── TREND FEED ───────────────────────────────────────────────────────────────

create table trend_feed (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  topic text not null,
  source text not null,
  relevance integer not null default 50 check (relevance between 0 and 100),
  url text,
  summary text,
  detected_at timestamptz not null default now(),
  actioned boolean not null default false
);

-- ─── REVIEWS ──────────────────────────────────────────────────────────────────

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  platform review_platform not null,
  external_review_id text,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  body text,
  response text,
  status review_status not null default 'new',
  posted_at timestamptz not null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, platform, external_review_id)
);

create index reviews_business_status_idx on reviews (business_id, status, posted_at desc);

-- ─── AGENT SYSTEM ─────────────────────────────────────────────────────────────

create table agent_jobs (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  type agent_job_type not null,
  status agent_job_status not null default 'queued',
  trigger text not null default 'manual',
  result_json jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index agent_jobs_business_status_idx on agent_jobs (business_id, status, created_at desc);

create table agent_signals (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  type signal_type not null,
  title text not null,
  body text not null,
  action_label text,
  action_type signal_action_type not null default 'none',
  action_data_json jsonb,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

create index agent_signals_business_active_idx on agent_signals (business_id, dismissed, created_at desc);

create table agent_memory (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  key text not null,
  value_text text not null,
  embedding vector(1536),
  updated_at timestamptz not null default now(),
  unique (business_id, key)
);

create table daily_tasks (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  date date not null,
  tasks_json jsonb not null default '[]',
  completed_count integer not null default 0,
  total_count integer not null default 0,
  unique (business_id, date)
);

create table chat_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  messages_json jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── BUSINESS METRICS ─────────────────────────────────────────────────────────

create table business_metrics (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  date date not null,
  health_score integer not null default 0,
  metrics_json jsonb not null default '{}',
  unique (business_id, date)
);

-- ─── BILLING ──────────────────────────────────────────────────────────────────

create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade unique,
  plan plan_type not null default 'starter',
  status billing_status not null default 'trialing',
  stripe_subscription_id text unique,
  stripe_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── FEATURE FLAGS ────────────────────────────────────────────────────────────

create table feature_flags (
  id uuid primary key default uuid_generate_v4(),
  flag_key text not null unique,
  description text,
  enabled_globally boolean not null default false,
  enabled_for_plans plan_type[],
  enabled_for_workspace_ids uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── AI USAGE LOG ─────────────────────────────────────────────────────────────

create table ai_usage_log (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  feature text not null,
  model text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  cost_usd numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

create index ai_usage_workspace_date_idx on ai_usage_log (workspace_id, created_at desc);

-- ─── FREE TOOL LEADS ──────────────────────────────────────────────────────────

create table free_tool_leads (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  name text,
  tool_used text not null,
  result_json jsonb,
  ip_address text,
  converted_to_user boolean not null default false,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index free_tool_leads_email_idx on free_tool_leads (email);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table profiles enable row level security;
alter table businesses enable row level security;
alter table integrations enable row level security;
alter table posts enable row level security;
alter table leads enable row level security;
alter table lead_activities enable row level security;
alter table deals enable row level security;
alter table audits enable row level security;
alter table competitors enable row level security;
alter table competitor_activity enable row level security;
alter table trend_feed enable row level security;
alter table reviews enable row level security;
alter table agent_jobs enable row level security;
alter table agent_signals enable row level security;
alter table agent_memory enable row level security;
alter table daily_tasks enable row level security;
alter table chat_sessions enable row level security;
alter table business_metrics enable row level security;
alter table subscriptions enable row level security;
alter table ai_usage_log enable row level security;

-- Profiles: users can only read/update their own profile
create policy "profiles_own" on profiles
  for all using (auth.uid() = id);

-- Workspace members can see their workspace
create policy "workspace_members_own" on workspace_members
  for select using (auth.uid() = user_id);

-- Workspaces: only members can see their workspace
create policy "workspaces_members" on workspaces
  for select using (
    id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- Businesses: workspace members only
create policy "businesses_workspace_members" on businesses
  for all using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- Apply same pattern to all business-scoped tables
create policy "integrations_business_members" on integrations
  for all using (
    business_id in (
      select b.id from businesses b
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );

create policy "posts_business_members" on posts for all using (
  business_id in (select b.id from businesses b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

create policy "leads_business_members" on leads for all using (
  business_id in (select b.id from businesses b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

create policy "lead_activities_via_lead" on lead_activities for all using (
  lead_id in (select l.id from leads l join businesses b on b.id = l.business_id join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

create policy "deals_business_members" on deals for all using (
  business_id in (select b.id from businesses b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

create policy "audits_business_members" on audits for all using (
  business_id in (select b.id from businesses b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

create policy "agent_signals_business_members" on agent_signals for all using (
  business_id in (select b.id from businesses b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

create policy "daily_tasks_business_members" on daily_tasks for all using (
  business_id in (select b.id from businesses b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

create policy "chat_sessions_own" on chat_sessions for all using (user_id = auth.uid());

create policy "reviews_business_members" on reviews for all using (
  business_id in (select b.id from businesses b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

create policy "business_metrics_business_members" on business_metrics for all using (
  business_id in (select b.id from businesses b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

create policy "trend_feed_business_members" on trend_feed for all using (
  business_id in (select b.id from businesses b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

create policy "competitors_business_members" on competitors for all using (
  business_id in (select b.id from businesses b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

create policy "subscriptions_workspace_members" on subscriptions for select using (
  workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
);

-- ─── TRIGGERS ─────────────────────────────────────────────────────────────────

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  new_workspace_id uuid;
begin
  -- Create profile
  insert into profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));

  -- Create default workspace
  insert into workspaces (name, owner_id)
  values (coalesce(new.raw_user_meta_data->>'name', 'My Workspace') || '''s Workspace', new.id)
  returning id into new_workspace_id;

  -- Add user as owner of workspace
  insert into workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  -- Set current workspace
  update profiles set current_workspace_id = new_workspace_id where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_profiles_updated_at before update on profiles for each row execute procedure update_updated_at();
create trigger update_workspaces_updated_at before update on workspaces for each row execute procedure update_updated_at();
create trigger update_businesses_updated_at before update on businesses for each row execute procedure update_updated_at();
create trigger update_posts_updated_at before update on posts for each row execute procedure update_updated_at();
create trigger update_leads_updated_at before update on leads for each row execute procedure update_updated_at();
create trigger update_deals_updated_at before update on deals for each row execute procedure update_updated_at();
create trigger update_subscriptions_updated_at before update on subscriptions for each row execute procedure update_updated_at();
