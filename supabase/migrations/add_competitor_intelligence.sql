-- Extend competitors table with AI intelligence fields
alter table competitors add column if not exists description text;
alter table competitors add column if not exists industry text;
alter table competitors add column if not exists location text;
alter table competitors add column if not exists auto_discovered boolean default false;

-- Ratings & Reviews
alter table competitors add column if not exists google_rating numeric(3,1);
alter table competitors add column if not exists google_review_count integer default 0;

-- Social media
alter table competitors add column if not exists facebook_followers integer;
alter table competitors add column if not exists facebook_rating numeric(3,1);
alter table competitors add column if not exists linkedin_followers integer;
alter table competitors add column if not exists instagram_url text;
alter table competitors add column if not exists twitter_url text;

-- Digital presence (AI-estimated)
alter table competitors add column if not exists domain_authority integer;
alter table competitors add column if not exists monthly_traffic integer;
alter table competitors add column if not exists top_keywords jsonb default '[]';

-- Business intelligence (from Claude analysis)
alter table competitors add column if not exists services_offered jsonb default '[]';
alter table competitors add column if not exists pricing_tier text; -- 'budget' | 'mid' | 'premium'
alter table competitors add column if not exists target_audience text;
alter table competitors add column if not exists unique_selling_points jsonb default '[]';
alter table competitors add column if not exists weaknesses jsonb default '[]';

-- AI analysis results
alter table competitors add column if not exists ai_summary text;
alter table competitors add column if not exists intelligence_score integer default 0; -- 0-100
alter table competitors add column if not exists threat_level text default 'unknown'; -- 'low' | 'medium' | 'high'
alter table competitors add column if not exists crawl_status text default 'pending'; -- 'pending' | 'scanning' | 'done' | 'error'
alter table competitors add column if not exists last_scanned_at timestamptz;
alter table competitors add column if not exists raw_website_text text;

-- Gap analysis per competitor
create table if not exists competitor_insights (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  competitor_id uuid references competitors(id) on delete cascade,
  insight_type text not null, -- 'gap' | 'opportunity' | 'threat' | 'advantage' | 'action'
  category text, -- 'seo' | 'social' | 'content' | 'pricing' | 'service' | 'reputation'
  title text not null,
  body text,
  priority integer default 0,
  created_at timestamptz default now()
);
