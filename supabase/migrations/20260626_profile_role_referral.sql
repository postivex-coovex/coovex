-- Add role and referral_source to profiles
alter table profiles
  add column if not exists role            text,
  add column if not exists referral_source text;
