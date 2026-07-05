alter table businesses
  add column if not exists pricing_packages jsonb,
  add column if not exists pricing_mode     text not null default 'url' check (pricing_mode in ('url','manual','none'));
