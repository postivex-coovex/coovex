-- Track last time a user visited the platform (for re-engagement)
alter table profiles add column if not exists last_seen_at timestamptz;
alter table profiles add column if not exists reengagement_sent_at jsonb not null default '{}'::jsonb;

-- Index for cron query (find inactive users quickly)
create index if not exists profiles_last_seen_at_idx on profiles (last_seen_at);
