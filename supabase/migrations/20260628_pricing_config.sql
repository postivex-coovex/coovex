-- ── Pricing Plans (admin-managed) ───────────────────────────────────────────

create table if not exists pricing_plans (
  id              uuid primary key default uuid_generate_v4(),
  key             text not null unique,          -- starter, growth, scale, agency
  name            text not null,
  price_monthly   integer not null default 0,    -- USD cents → 2900 = $29
  price_annual    integer not null default 0,    -- USD cents per month, billed annually
  credits_monthly integer not null default 0,
  max_leads       integer not null default 0,    -- -1 = unlimited
  max_competitors integer not null default 0,
  max_team        integer not null default 1,
  max_workspaces  integer not null default 1,
  features        jsonb not null default '[]',   -- array of {label, ok}
  highlight       boolean not null default false,
  active          boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Credit Cost Settings ──────────────────────────────────────────────────────

create table if not exists credit_cost_settings (
  id          uuid primary key default uuid_generate_v4(),
  feature_key text not null unique,
  cost        integer not null default 1,
  label       text not null,
  tier        text not null default 'light',   -- light | medium | tool
  note        text,
  updated_at  timestamptz not null default now()
);

-- ── RLS: public read, only service role writes ───────────────────────────────

alter table pricing_plans        enable row level security;
alter table credit_cost_settings enable row level security;

drop policy if exists "Public read pricing_plans"        on pricing_plans;
drop policy if exists "Public read credit_cost_settings" on credit_cost_settings;

create policy "Public read pricing_plans"
  on pricing_plans for select using (true);

create policy "Public read credit_cost_settings"
  on credit_cost_settings for select using (true);

-- ── Seed pricing plans ────────────────────────────────────────────────────────

insert into pricing_plans (key, name, price_monthly, price_annual, credits_monthly, max_leads, max_competitors, max_team, max_workspaces, highlight, sort_order, features) values
(
  'starter', 'Starter', 2900, 2300, 500, 100, 3, 1, 1, false, 1,
  '[
    {"label":"500 AI credits / month","ok":true},
    {"label":"100 leads","ok":true},
    {"label":"3 competitors monitored","ok":true},
    {"label":"AI Coach & Daily Brief","ok":true},
    {"label":"Website audit & GEO","ok":true},
    {"label":"Basic analytics","ok":true},
    {"label":"1 team member","ok":true},
    {"label":"CRM integrations","ok":false},
    {"label":"White-label","ok":false},
    {"label":"Agency dashboard","ok":false}
  ]'::jsonb
),
(
  'growth', 'Growth', 7900, 6300, 2000, 500, 10, 5, 3, true, 2,
  '[
    {"label":"2,000 AI credits / month","ok":true},
    {"label":"500 leads","ok":true},
    {"label":"10 competitors monitored","ok":true},
    {"label":"All AI features","ok":true},
    {"label":"Cold lead finder","ok":true},
    {"label":"Drip campaigns","ok":true},
    {"label":"5 team members","ok":true},
    {"label":"Priority support","ok":true},
    {"label":"White-label","ok":false},
    {"label":"Agency dashboard","ok":false}
  ]'::jsonb
),
(
  'scale', 'Scale', 14900, 11900, 6000, 2000, 25, 10, 10, false, 3,
  '[
    {"label":"6,000 AI credits / month","ok":true},
    {"label":"2,000 leads","ok":true},
    {"label":"25 competitors monitored","ok":true},
    {"label":"All AI features","ok":true},
    {"label":"White-label & custom domain","ok":true},
    {"label":"CRM integrations","ok":true},
    {"label":"Proposals & AI reports","ok":true},
    {"label":"10 team members","ok":true},
    {"label":"Dedicated support","ok":true},
    {"label":"Agency dashboard","ok":false}
  ]'::jsonb
),
(
  'agency', 'Agency', 29900, 23900, 20000, -1, -1, -1, -1, false, 4,
  '[
    {"label":"20,000 AI credits / month","ok":true},
    {"label":"Unlimited leads","ok":true},
    {"label":"Unlimited competitors","ok":true},
    {"label":"All AI features","ok":true},
    {"label":"Full white-label + domain","ok":true},
    {"label":"Multi-client dashboard","ok":true},
    {"label":"All integrations + API","ok":true},
    {"label":"Unlimited team members","ok":true},
    {"label":"SLA + account manager","ok":true},
    {"label":"Custom credit top-ups","ok":true}
  ]'::jsonb
)
on conflict (key) do nothing;

-- ── Seed credit costs ─────────────────────────────────────────────────────────

insert into credit_cost_settings (feature_key, cost, label, tier, note) values
('chat_message',        2,  'AI Chat message',        'light',  '~250/mo on Starter'),
('chat_tool_action',    3,  'Chat + tool action',     'light',  'e.g. create post via chat'),
('daily_brief',         5,  'Daily Brief',            'light',  'once per day'),
('lead_score',          2,  'Lead AI scoring',        'light',  'per lead'),
('cold_lead_search',    10, 'Cold lead search',       'medium', 'Reddit / HN scan'),
('competitor_analysis', 15, 'Competitor full scan',   'medium', 'per scan'),
('website_audit',       20, 'Website Audit',          'medium', 'full + GEO check'),
('report_generate',     15, 'Report generation',      'medium', ''),
('proposal_generate',   20, 'Proposal generation',    'medium', ''),
('swot_analysis',       15, 'SWOT Analysis',          'tool',   ''),
('marketing_plan',      30, 'Marketing Plan',         'tool',   ''),
('pitch_deck',          40, 'Pitch Deck',             'tool',   ''),
('business_plan',       50, 'Business Plan',          'tool',   ''),
('lead_research',        5, 'Lead Research',          'light',  ''),
('review_response',      3, 'Review Response Draft',  'light',  ''),
('content_generate',     8, 'Content Generation',     'medium', ''),
('campaign_create',     10, 'Campaign Creation',      'medium', ''),
('drip_email',           5, 'Drip Email (per email)', 'medium', ''),
('forecast_generate',   10, 'Forecast Generation',    'medium', ''),
('business_valuation',  10, 'Business Valuation',     'tool',   ''),
('icp_builder',         15, 'ICP Builder',            'tool',   '')
on conflict (feature_key) do nothing;
