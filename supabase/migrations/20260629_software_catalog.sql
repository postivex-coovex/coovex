-- ─── Software Catalog & Workspace Stack ──────────────────────────────────────

create table if not exists software_catalog (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  category text not null,
  tagline text,
  description text,
  website text,
  logo_url text,
  pricing_model text not null default 'paid',
  price_from integer default 0,
  features text[] default '{}',
  integrations text[] default '{}',
  best_for_industries text[] default '{}',
  best_for_sizes text[] default '{}',
  rating numeric(3,1) default 4.0,
  is_coovex_pick boolean not null default false,
  affiliate_url text,
  sort_order integer default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_software_stack (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  software_id uuid not null references software_catalog(id) on delete cascade,
  status text not null default 'using',
  notes text,
  added_at timestamptz not null default now(),
  unique(workspace_id, software_id)
);

alter table software_catalog enable row level security;
alter table workspace_software_stack enable row level security;

drop policy if exists "Public read software_catalog" on software_catalog;
create policy "Public read software_catalog" on software_catalog for select using (true);

drop policy if exists "Users manage own stack" on workspace_software_stack;
create policy "Users manage own stack" on workspace_software_stack
  for all using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- ─── Seed: CRM ───────────────────────────────────────────────────────────────

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('HubSpot', 'hubspot', 'crm', 'The CRM platform for scaling companies', 'All-in-one CRM with marketing, sales, and service hubs. Free CRM forever with premium upgrades.', 'https://hubspot.com', 'freemium', 0, ARRAY['Contact management','Email tracking','Pipeline management','Marketing automation','Reporting'], ARRAY['saas','agency','ecommerce','b2b'], ARRAY['1','2-10','11-50','51-200'], 4.5, true, 10)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Pipedrive', 'pipedrive', 'crm', 'The sales CRM built for salespeople', 'Visual pipeline CRM focused on activity-based selling. Simple, powerful, and loved by sales teams.', 'https://pipedrive.com', 'paid', 1490, ARRAY['Visual pipeline','Email integration','Activity reminders','Reporting','Mobile app'], ARRAY['saas','agency','b2b','consulting'], ARRAY['1','2-10','11-50'], 4.4, false, 20)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Salesforce', 'salesforce', 'crm', 'The world''s #1 CRM platform', 'Enterprise CRM with deep customization, automation, and integrations. Industry standard for large sales teams.', 'https://salesforce.com', 'paid', 2500, ARRAY['Lead management','Opportunity tracking','AI insights','Custom workflows','App marketplace'], ARRAY['enterprise','b2b','financial','healthcare'], ARRAY['51-200','201+'], 4.3, false, 30)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Zoho CRM', 'zoho-crm', 'crm', 'Close more deals in less time', 'Feature-rich CRM with AI-powered sales assistant. Free for 3 users, scales to enterprise.', 'https://zoho.com/crm', 'freemium', 0, ARRAY['Lead scoring','Workflow automation','AI assistant','Social CRM','Analytics'], ARRAY['saas','b2b','retail','ecommerce'], ARRAY['1','2-10','11-50'], 4.2, false, 40)
on conflict (slug) do nothing;

-- ─── Seed: Email Marketing ────────────────────────────────────────────────────

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Mailchimp', 'mailchimp', 'email_marketing', 'Email marketing for everyone', 'The most popular email marketing platform with automation, landing pages, and audience tools. Free up to 500 contacts.', 'https://mailchimp.com', 'freemium', 0, ARRAY['Email campaigns','Automation','Landing pages','Audience segmentation','A/B testing'], ARRAY['ecommerce','retail','agency','nonprofit'], ARRAY['1','2-10','11-50'], 4.3, false, 10)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('ActiveCampaign', 'activecampaign', 'email_marketing', 'Email, automation, and CRM combined', 'Advanced marketing automation with built-in CRM. Best-in-class automation builder for growing businesses.', 'https://activecampaign.com', 'paid', 2900, ARRAY['Email automation','CRM built-in','Lead scoring','Site tracking','SMS marketing'], ARRAY['saas','ecommerce','agency','b2b'], ARRAY['2-10','11-50','51-200'], 4.5, false, 20)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Brevo', 'brevo', 'email_marketing', 'All-in-one marketing platform', 'Formerly Sendinblue. Email, SMS, WhatsApp, and CRM tools. Generous free plan with unlimited contacts.', 'https://brevo.com', 'freemium', 0, ARRAY['Email & SMS','WhatsApp campaigns','Transactional email','Chat','CRM'], ARRAY['ecommerce','saas','agency','startup'], ARRAY['1','2-10','11-50'], 4.3, false, 30)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('ConvertKit', 'convertkit', 'email_marketing', 'Email marketing for creators', 'Built for content creators, bloggers, and course sellers. Simple but powerful automation and tagging.', 'https://kit.com', 'freemium', 0, ARRAY['Visual automations','Subscriber tagging','Landing pages','Commerce','Creator network'], ARRAY['media','education','creator','consulting'], ARRAY['1','2-10'], 4.4, false, 40)
on conflict (slug) do nothing;

-- ─── Seed: Project Management ─────────────────────────────────────────────────

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Notion', 'notion', 'project_management', 'One workspace for your whole team', 'All-in-one workspace combining notes, wikis, databases, and project management. Extremely flexible.', 'https://notion.so', 'freemium', 0, ARRAY['Databases','Wikis','Project boards','AI writing','Team collaboration'], ARRAY['saas','agency','startup','education'], ARRAY['1','2-10','11-50'], 4.7, true, 10)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('ClickUp', 'clickup', 'project_management', 'One app to replace them all', 'Highly customizable project management with tasks, docs, goals, and time tracking. Generous free plan.', 'https://clickup.com', 'freemium', 0, ARRAY['Tasks & subtasks','Goals','Time tracking','Docs','Automation'], ARRAY['agency','saas','consulting','ecommerce'], ARRAY['1','2-10','11-50','51-200'], 4.5, true, 20)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Asana', 'asana', 'project_management', 'Work on big ideas, without the chaos', 'Clean project management with timelines, portfolios, and reporting. Popular with marketing teams.', 'https://asana.com', 'freemium', 0, ARRAY['Timeline view','Portfolios','Rules automation','Workload','Forms'], ARRAY['agency','marketing','enterprise','nonprofit'], ARRAY['2-10','11-50','51-200'], 4.4, false, 30)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Monday.com', 'monday', 'project_management', 'Work OS that powers teams', 'Visual work management platform with highly customizable boards. Strong for cross-team collaboration.', 'https://monday.com', 'paid', 900, ARRAY['Custom boards','Automations','Integrations','Dashboards','Time tracking'], ARRAY['agency','enterprise','construction','saas'], ARRAY['2-10','11-50','51-200'], 4.3, false, 40)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Trello', 'trello', 'project_management', 'Boards, lists, and cards for teams', 'Simple Kanban-based project management owned by Atlassian. Excellent free plan for small teams.', 'https://trello.com', 'freemium', 0, ARRAY['Kanban boards','Power-Ups','Butler automation','Team collaboration','Mobile app'], ARRAY['startup','agency','education','nonprofit'], ARRAY['1','2-10'], 4.3, false, 50)
on conflict (slug) do nothing;

-- ─── Seed: Accounting ────────────────────────────────────────────────────────

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('QuickBooks', 'quickbooks', 'accounting', 'Accounting software for small business', 'The most widely used small business accounting software. Invoicing, expenses, payroll, and taxes.', 'https://quickbooks.intuit.com', 'paid', 3000, ARRAY['Invoicing','Expense tracking','Payroll','Tax filing','Bank sync'], ARRAY['retail','ecommerce','consulting','agency'], ARRAY['1','2-10','11-50'], 4.3, true, 10)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Xero', 'xero', 'accounting', 'Beautiful accounting software', 'Cloud-based accounting with strong bank reconciliation and integrations. Popular outside the US.', 'https://xero.com', 'paid', 1500, ARRAY['Bank reconciliation','Invoicing','Expense claims','Payroll','Financial reports'], ARRAY['retail','ecommerce','consulting','saas'], ARRAY['1','2-10','11-50'], 4.4, false, 20)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Wave', 'wave', 'accounting', 'Free accounting for small businesses', '100% free accounting, invoicing, and receipt scanning. Charges only for payroll and payments.', 'https://waveapps.com', 'free', 0, ARRAY['Free invoicing','Free accounting','Receipt scanning','Financial reports','Bank sync'], ARRAY['freelancer','startup','nonprofit','retail'], ARRAY['1','2-10'], 4.2, false, 30)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('FreshBooks', 'freshbooks', 'accounting', 'Accounting built for owners', 'Simple invoicing and accounting designed for self-employed professionals and small business owners.', 'https://freshbooks.com', 'paid', 1900, ARRAY['Invoicing','Time tracking','Expense management','Project profitability','Client portal'], ARRAY['freelancer','consulting','agency','creative'], ARRAY['1','2-10'], 4.4, false, 40)
on conflict (slug) do nothing;

-- ─── Seed: Analytics ─────────────────────────────────────────────────────────

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Google Analytics', 'google-analytics', 'analytics', 'Free website analytics by Google', 'The most widely used web analytics platform. GA4 offers events-based tracking, funnel analysis, and integration with Google Ads.', 'https://analytics.google.com', 'free', 0, ARRAY['Real-time analytics','Conversion tracking','Audience insights','Google Ads integration','Custom reports'], ARRAY['ecommerce','saas','media','agency'], ARRAY['1','2-10','11-50','51-200'], 4.4, true, 10)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Hotjar', 'hotjar', 'analytics', 'See how users really use your site', 'Heatmaps, session recordings, and user surveys to understand visitor behavior. Perfect complement to GA.', 'https://hotjar.com', 'freemium', 0, ARRAY['Heatmaps','Session recordings','Surveys','Funnel analysis','Feedback widgets'], ARRAY['ecommerce','saas','agency'], ARRAY['1','2-10','11-50'], 4.4, false, 20)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Mixpanel', 'mixpanel', 'analytics', 'Product analytics for growth teams', 'Event-based product analytics focused on user behavior and retention. Best for SaaS and mobile apps.', 'https://mixpanel.com', 'freemium', 0, ARRAY['Event tracking','Funnels','Retention analysis','A/B testing','User profiles'], ARRAY['saas','startup','mobile','b2b'], ARRAY['2-10','11-50','51-200'], 4.4, false, 30)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Plausible', 'plausible', 'analytics', 'Privacy-first web analytics', 'Simple, privacy-friendly analytics with no cookies and GDPR compliance out of the box. Open-source option available.', 'https://plausible.io', 'paid', 900, ARRAY['Privacy-first','No cookies','GDPR compliant','Simple dashboard','Goal tracking'], ARRAY['saas','media','agency','startup'], ARRAY['1','2-10'], 4.5, false, 40)
on conflict (slug) do nothing;

-- ─── Seed: Customer Support ───────────────────────────────────────────────────

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Freshdesk', 'freshdesk', 'customer_support', 'Delightful customer service for teams', 'Full-featured helpdesk with ticketing, live chat, and knowledge base. Generous free plan for small teams.', 'https://freshdesk.com', 'freemium', 0, ARRAY['Ticketing system','Live chat','Knowledge base','Automation','Team inbox'], ARRAY['saas','ecommerce','retail','startup'], ARRAY['1','2-10','11-50'], 4.4, true, 10)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Intercom', 'intercom', 'customer_support', 'AI-first customer service platform', 'Premium customer messaging platform with AI chatbots, help center, and product tours. Strong for SaaS.', 'https://intercom.com', 'paid', 7400, ARRAY['AI chatbot','Live chat','Product tours','Help center','Customer data'], ARRAY['saas','b2b','startup'], ARRAY['11-50','51-200'], 4.3, false, 20)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Zendesk', 'zendesk', 'customer_support', 'Customer service for enterprise', 'Enterprise-grade ticketing and support platform. Used by thousands of companies worldwide.', 'https://zendesk.com', 'paid', 4900, ARRAY['Ticketing','Help center','AI answers','Analytics','Workforce management'], ARRAY['enterprise','ecommerce','saas','financial'], ARRAY['51-200','201+'], 4.2, false, 30)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Crisp', 'crisp', 'customer_support', 'Chat with your customers for free', 'Modern customer messaging with a generous free plan. Live chat, email, and chatbot in one inbox.', 'https://crisp.chat', 'freemium', 0, ARRAY['Live chat','Shared inbox','Chatbot','Knowledge base','Mobile app'], ARRAY['startup','saas','ecommerce'], ARRAY['1','2-10'], 4.4, false, 40)
on conflict (slug) do nothing;

-- ─── Seed: Social Media ───────────────────────────────────────────────────────

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Buffer', 'buffer', 'social_media', 'Social media scheduling made simple', 'Clean, easy social media scheduling and analytics. Beloved by small businesses and creators.', 'https://buffer.com', 'freemium', 0, ARRAY['Post scheduling','Analytics','Engagement','AI assistant','Link in bio'], ARRAY['agency','startup','creator','ecommerce'], ARRAY['1','2-10','11-50'], 4.5, true, 10)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Later', 'later', 'social_media', 'Social media planning and scheduling', 'Visual content calendar focused on Instagram, TikTok, and Pinterest. Best for visual brands.', 'https://later.com', 'freemium', 0, ARRAY['Visual calendar','Auto-publish','Link in bio','Analytics','Hashtag suggestions'], ARRAY['ecommerce','creator','retail','fashion'], ARRAY['1','2-10'], 4.3, false, 20)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Hootsuite', 'hootsuite', 'social_media', 'Social media management for enterprises', 'Industry-leading social media management with scheduling, monitoring, and team workflows.', 'https://hootsuite.com', 'paid', 9900, ARRAY['Multi-platform scheduling','Social listening','Team collaboration','Analytics','Ad management'], ARRAY['enterprise','agency','media','retail'], ARRAY['11-50','51-200'], 4.1, false, 30)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Canva', 'canva', 'social_media', 'Design anything. Publish anywhere.', 'The most popular design tool for non-designers. Templates for social, presentations, and marketing materials.', 'https://canva.com', 'freemium', 0, ARRAY['1000s of templates','Brand kit','Social publishing','AI design tools','Team collaboration'], ARRAY['agency','startup','ecommerce','creator'], ARRAY['1','2-10','11-50'], 4.7, false, 40)
on conflict (slug) do nothing;

-- ─── Seed: HR & Payroll ───────────────────────────────────────────────────────

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Gusto', 'gusto', 'hr_payroll', 'Full-service payroll & HR for US businesses', 'All-in-one HR platform with payroll, benefits, and compliance. Popular with US small businesses.', 'https://gusto.com', 'paid', 4000, ARRAY['Payroll','Benefits','Time tracking','Compliance','Onboarding'], ARRAY['startup','retail','agency','ecommerce'], ARRAY['1','2-10','11-50'], 4.5, false, 10)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Deel', 'deel', 'hr_payroll', 'Hire and pay anyone, anywhere', 'Global payroll and contractor payments in 150+ countries. Best for remote-first and international teams.', 'https://deel.com', 'paid', 4900, ARRAY['Global payroll','Contractor payments','Compliance','EOR services','Benefits'], ARRAY['saas','startup','agency','remote'], ARRAY['2-10','11-50','51-200'], 4.4, false, 20)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Remote', 'remote', 'hr_payroll', 'Employ, pay, and manage international teams', 'Employer of Record (EOR) services for hiring employees globally without setting up local entities.', 'https://remote.com', 'paid', 29900, ARRAY['Global EOR','Contractor management','Payroll','IP protection','Benefits'], ARRAY['saas','startup','enterprise'], ARRAY['2-10','11-50'], 4.3, false, 30)
on conflict (slug) do nothing;

-- ─── Seed: Communication ─────────────────────────────────────────────────────

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Slack', 'slack', 'communication', 'Where work happens', 'The most popular team messaging platform. Channels, DMs, file sharing, and a massive app ecosystem.', 'https://slack.com', 'freemium', 0, ARRAY['Channels','Huddles','File sharing','Workflow builder','App integrations'], ARRAY['saas','startup','agency','enterprise'], ARRAY['1','2-10','11-50','51-200'], 4.6, true, 10)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Microsoft Teams', 'microsoft-teams', 'communication', 'Meet, chat, call, and collaborate', 'Microsoft''s collaboration hub with deep Office 365 integration. Best for Microsoft-centric organizations.', 'https://teams.microsoft.com', 'freemium', 0, ARRAY['Video meetings','Team channels','File collaboration','Office integration','Phone system'], ARRAY['enterprise','education','healthcare','financial'], ARRAY['11-50','51-200','201+'], 4.2, false, 20)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Zoom', 'zoom', 'communication', 'Video communications for everyone', 'The leading video conferencing platform. Reliable meetings, webinars, and phone system.', 'https://zoom.us', 'freemium', 0, ARRAY['HD video meetings','Webinars','Recording','Breakout rooms','Whiteboard'], ARRAY['saas','agency','education','enterprise'], ARRAY['1','2-10','11-50','51-200'], 4.4, false, 30)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Loom', 'loom', 'communication', 'Async video messaging for work', 'Record and share quick video messages. Perfect for async teams, code reviews, and client updates.', 'https://loom.com', 'freemium', 0, ARRAY['Screen recording','Async video','Comments','Transcripts','Analytics'], ARRAY['saas','agency','remote','startup'], ARRAY['1','2-10','11-50'], 4.6, false, 40)
on conflict (slug) do nothing;

-- ─── Seed: Ecommerce ─────────────────────────────────────────────────────────

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Shopify', 'shopify', 'ecommerce', 'Start, grow, and manage your business', 'The most popular ecommerce platform. Everything you need to sell online or in-person.', 'https://shopify.com', 'paid', 2900, ARRAY['Online store','POS','Payments','Inventory','Marketing'], ARRAY['retail','ecommerce','fashion','food'], ARRAY['1','2-10','11-50'], 4.5, false, 10)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('WooCommerce', 'woocommerce', 'ecommerce', 'The open-source ecommerce platform', 'Free WordPress plugin for ecommerce. Full control and customization for WordPress-based stores.', 'https://woocommerce.com', 'free', 0, ARRAY['Open source','WordPress integration','Unlimited products','Payment gateways','Extensions'], ARRAY['retail','ecommerce','publishing','creator'], ARRAY['1','2-10','11-50'], 4.3, false, 20)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Stripe', 'stripe', 'ecommerce', 'Payments infrastructure for the internet', 'Developer-friendly payment processing used by millions of businesses. Best-in-class APIs and reliability.', 'https://stripe.com', 'free', 0, ARRAY['Payment processing','Subscriptions','Invoicing','Connect marketplace','Fraud prevention'], ARRAY['saas','ecommerce','startup','marketplace'], ARRAY['1','2-10','11-50','51-200'], 4.7, true, 30)
on conflict (slug) do nothing;

-- ─── Seed: Automation ────────────────────────────────────────────────────────

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Zapier', 'zapier', 'automation', 'Connect your apps and automate workflows', 'The most popular no-code automation platform. 6,000+ app integrations and powerful multi-step Zaps.', 'https://zapier.com', 'freemium', 0, ARRAY['6000+ integrations','Multi-step Zaps','Filters & logic','Tables','Webhooks'], ARRAY['saas','agency','ecommerce','startup'], ARRAY['1','2-10','11-50'], 4.5, true, 10)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Make', 'make', 'automation', 'Visual automation for complex workflows', 'Formerly Integromat. More powerful visual automation than Zapier with lower cost per operation.', 'https://make.com', 'freemium', 0, ARRAY['Visual builder','Complex logic','Data transformation','Webhooks','API calls'], ARRAY['saas','agency','startup','ecommerce'], ARRAY['1','2-10','11-50'], 4.5, false, 20)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('n8n', 'n8n', 'automation', 'Self-hostable workflow automation', 'Open-source automation tool you can self-host. No per-operation limits and full code flexibility.', 'https://n8n.io', 'free', 0, ARRAY['Self-hosted option','400+ integrations','Code nodes','AI workflows','Custom nodes'], ARRAY['saas','startup','developer','agency'], ARRAY['1','2-10','11-50'], 4.4, false, 30)
on conflict (slug) do nothing;

-- ─── Seed: AI Tools ──────────────────────────────────────────────────────────

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('ChatGPT Plus', 'chatgpt-plus', 'ai_tools', 'AI assistant by OpenAI', 'The most widely used AI assistant. GPT-4o with image generation, code interpreter, and web browsing.', 'https://chat.openai.com', 'paid', 2000, ARRAY['GPT-4o','DALL-E image gen','Code interpreter','Web browsing','Custom GPTs'], ARRAY['saas','agency','consulting','creator'], ARRAY['1','2-10'], 4.6, false, 10)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Grammarly', 'grammarly', 'ai_tools', 'AI writing assistant for everyone', 'AI-powered grammar, style, and tone checker. Integrates with virtually every text editor and browser.', 'https://grammarly.com', 'freemium', 0, ARRAY['Grammar checking','Tone detection','Style suggestions','Plagiarism check','Browser extension'], ARRAY['agency','consulting','education','creator'], ARRAY['1','2-10','11-50'], 4.5, false, 20)
on conflict (slug) do nothing;

insert into software_catalog (name, slug, category, tagline, description, website, pricing_model, price_from, features, best_for_industries, best_for_sizes, rating, is_coovex_pick, sort_order) values
('Notion AI', 'notion-ai', 'ai_tools', 'AI built into your workspace', 'AI features built directly into Notion. Write, edit, summarize, and translate without leaving your workspace.', 'https://notion.so/product/ai', 'paid', 1000, ARRAY['AI writing','Q&A over pages','Summarization','Translation','Action items'], ARRAY['saas','agency','startup','creator'], ARRAY['1','2-10','11-50'], 4.4, false, 30)
on conflict (slug) do nothing;
