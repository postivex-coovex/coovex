-- CooVex Dev plugin license registry
-- Tracks which site URL each API key is registered to.
-- Enables site-URL binding and license revocation.

create table if not exists wp_dev_licenses (
  id               uuid primary key default gen_random_uuid(),
  api_key          text not null unique,
  workspace_id     uuid references workspaces(id) on delete cascade,
  site_url         text not null,
  plugin_version   text,
  first_validated  timestamptz not null default now(),
  last_validated   timestamptz not null default now(),
  revoked          boolean not null default false,
  revoked_at       timestamptz,
  revoked_reason   text,
  last_mismatch    timestamptz,
  mismatch_url     text,
  mismatch_count   int not null default 0
);

create index if not exists wp_dev_licenses_workspace_id on wp_dev_licenses(workspace_id);

-- Enable RLS (admins and the service role can read/write)
alter table wp_dev_licenses enable row level security;

create policy "service role full access" on wp_dev_licenses
  using (true)
  with check (true);

-- Helper: revoke a license (call from admin panel or support tooling)
create or replace function revoke_wp_dev_license(p_api_key text, p_reason text default null)
returns void language plpgsql security definer as $$
begin
  update wp_dev_licenses
  set revoked = true, revoked_at = now(), revoked_reason = p_reason
  where api_key = p_api_key;
end;
$$;

-- Auto-increment mismatch_count on update
create or replace function wp_dev_license_mismatch_increment()
returns trigger language plpgsql as $$
begin
  if new.last_mismatch is distinct from old.last_mismatch then
    new.mismatch_count := old.mismatch_count + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists wp_dev_license_mismatch_trigger on wp_dev_licenses;
create trigger wp_dev_license_mismatch_trigger
  before update on wp_dev_licenses
  for each row execute function wp_dev_license_mismatch_increment();

comment on table wp_dev_licenses is
  'WordPress plugin license registry. One row per API key. Site URL is locked on first validation. Use revoke_wp_dev_license() to disable a compromised key.';
