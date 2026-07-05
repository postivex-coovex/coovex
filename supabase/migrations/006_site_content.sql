-- ============================================================
-- 006_site_content.sql — Generic CMS table for site pages
-- ============================================================

CREATE TABLE IF NOT EXISTS site_content (
  key        text PRIMARY KEY,          -- e.g. 'about', 'home', 'privacy'
  value      jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read site content" ON site_content;
CREATE POLICY "Public can read site content" ON site_content
  FOR SELECT USING (true);

-- Seed default About page content
INSERT INTO site_content (key, value) VALUES ('about', '{
  "hero": {
    "badge": "Our Mission",
    "title": "Building the future of AI business intelligence",
    "subtitle": "We believe every business — no matter the size — deserves a 24/7 AI agent that monitors, alerts, and acts on their behalf."
  },
  "story": "CooVex was founded in 2024 after watching too many small businesses lose customers to competitors they didn''t even know existed. We set out to build an AI agent that levels the playing field — giving solo entrepreneurs and growing teams the same intelligence edge that enterprise companies pay millions for.",
  "mission": "To make AI-powered business intelligence accessible to every entrepreneur on the planet.",
  "vision": "A world where no business owner wakes up to surprises — every opportunity spotted, every threat flagged, before it matters.",
  "stats": [
    {"label": "Businesses monitored", "value": "2,400+"},
    {"label": "Countries", "value": "38"},
    {"label": "AI signals sent daily", "value": "50K+"},
    {"label": "Average health score lift", "value": "+24 pts"}
  ],
  "values": [
    {"icon": "🎯", "title": "Clarity over complexity", "description": "We turn overwhelming business data into a single daily briefing with clear actions. No dashboards to navigate, no guessing what matters."},
    {"icon": "⚡", "title": "Speed of insight", "description": "The difference between winning and losing is often hours. Our agent monitors 24/7 so you act on intelligence before your competitors do."},
    {"icon": "🤝", "title": "Built for real businesses", "description": "Every feature is designed for working business owners — not data scientists. If it takes more than 2 clicks, we rebuild it."},
    {"icon": "🔒", "title": "Trust through transparency", "description": "We explain every AI decision. You always know why the agent flagged something and what data it used to decide."}
  ],
  "team": [
    {"name": "Alex Rivera", "role": "CEO & Co-founder", "bio": "Former growth lead at Salesforce. Built 3 companies before CooVex. Obsessed with making AI actually useful for small business.", "avatar": "AR"},
    {"name": "Priya Sharma", "role": "CTO & Co-founder", "bio": "Ex-Google AI engineer. Led the team that built Google''s merchant intelligence platform before leaving to build CooVex.", "avatar": "PS"},
    {"name": "Daniel Osei", "role": "Head of Product", "bio": "10 years in SaaS product. Previously at HubSpot. Spent 2 years talking to 400+ business owners before joining CooVex.", "avatar": "DO"}
  ],
  "milestones": [
    {"year": "2024 Q1", "event": "Founded. First lines of code written."},
    {"year": "2024 Q3", "event": "Beta launched to 50 businesses. Competitor tracking feature born."},
    {"year": "2024 Q4", "event": "500 businesses onboarded. AI Coach launched."},
    {"year": "2025 Q2", "event": "Agency white label launched. First reseller partnerships."},
    {"year": "2025 Q4", "event": "2,000+ businesses. Expanded to 38 countries."},
    {"year": "2026", "event": "2,400+ businesses. Mobile app in development."}
  ]
}') ON CONFLICT (key) DO NOTHING;
