alter table businesses
  add column if not exists currency     text not null default 'USD',
  add column if not exists target_market text;
