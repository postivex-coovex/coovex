-- Onboarding step 1 fields for businesses
alter table businesses
  add column if not exists pricing_page_url   text,
  add column if not exists service_page_url   text,
  add column if not exists business_stage     text check (business_stage in ('idea','beta','live_no_users','live_transactions')),
  add column if not exists current_mrr        numeric(12,2),
  add column if not exists knows_icp          boolean not null default false,
  add column if not exists knows_competitors  boolean not null default false,
  add column if not exists has_marketing_plan boolean not null default false;
