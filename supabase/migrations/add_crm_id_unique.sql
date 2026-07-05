-- Add crm_id columns if they don't exist
alter table deals add column if not exists crm_id text;
alter table leads add column if not exists crm_id text;

-- Partial unique index — only enforces uniqueness on non-null crm_id values
-- This allows multiple manual (non-CRM) deals/leads with crm_id = null
create unique index if not exists deals_crm_id_unique on deals (crm_id) where crm_id is not null;
create unique index if not exists leads_crm_id_unique on leads (crm_id) where crm_id is not null;
