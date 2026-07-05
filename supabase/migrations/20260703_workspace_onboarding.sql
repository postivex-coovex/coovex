-- Track whether a workspace has completed the AI onboarding flow
alter table workspaces add column if not exists onboarding_completed boolean not null default false;

-- Existing workspaces are considered already onboarded
update workspaces set onboarding_completed = true where onboarding_completed = false;
