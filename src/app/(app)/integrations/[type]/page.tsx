'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Check, ExternalLink, ArrowLeft } from 'lucide-react'

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'password' | 'url' | 'select' | 'textarea'
  placeholder?: string
  options?: string[]
  hint?: string
}

interface SyncOption {
  key: string
  label: string
  desc: string
}

interface IntegrationConfig {
  name: string
  icon: string
  color: string
  description: string
  docsUrl: string
  authType: 'api_key' | 'oauth' | 'webhook'
  fields: FieldDef[]
  syncOptions: SyncOption[]
  setupSteps: string[]
  benefit?: string
  data_unlocked?: string[]
}

const CONFIGS: Record<string, IntegrationConfig> = {
  hubspot: {
    name: 'HubSpot', icon: '🧲', color: 'bg-orange-900/30 border-orange-800/40',
    description: 'Sync contacts, deals, and pipeline data bidirectionally with HubSpot CRM.',
    docsUrl: 'https://developers.hubspot.com/docs/api/overview',
    authType: 'oauth',
    fields: [
      { key: 'client_id',     label: 'App Client ID',     type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'client_secret', label: 'App Client Secret', type: 'password', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'portal_id',     label: 'HubSpot Portal ID', type: 'text',     placeholder: '12345678', hint: 'Found in HubSpot Settings → Account Setup' },
    ],
    syncOptions: [
      { key: 'contacts', label: 'Contacts → Leads',   desc: 'Import HubSpot contacts as CooVex leads' },
      { key: 'deals',    label: 'Deals → Pipeline',   desc: 'Mirror HubSpot deals in CooVex pipeline' },
      { key: 'export',   label: 'Export Leads',       desc: 'Push new CooVex leads back to HubSpot' },
    ],
    setupSteps: [
      'Go to HubSpot → Settings → Integrations → Private Apps → Create a private app',
      'Under Scopes, add: crm.objects.contacts.read, crm.objects.deals.read',
      'Copy the Access Token and paste it as your Client Secret above',
      'Save and click "Test Connection"',
    ],
  },
  pipedrive: {
    name: 'Pipedrive', icon: '🎯', color: 'bg-green-900/30 border-green-800/40',
    description: 'Pull deals and contacts from Pipedrive into your CooVex pipeline.',
    docsUrl: 'https://developers.pipedrive.com/docs/api/v1',
    authType: 'api_key',
    fields: [
      { key: 'api_token', label: 'API Token', type: 'password', placeholder: 'Your Pipedrive API token', hint: 'Settings → Personal Preferences → API' },
      { key: 'company_domain', label: 'Company Domain', type: 'text', placeholder: 'yourcompany.pipedrive.com' },
    ],
    syncOptions: [
      { key: 'deals',    label: 'Deals → Pipeline',   desc: 'Import Pipedrive deals as CooVex leads' },
      { key: 'contacts', label: 'Contacts → Leads',   desc: 'Import Pipedrive contacts' },
      { key: 'export',   label: 'Export Leads',       desc: 'Create Pipedrive deals from CooVex leads' },
    ],
    setupSteps: [
      'Log into Pipedrive → click your avatar → Settings',
      'Go to Personal Preferences → API',
      'Copy your personal API token',
      'Paste it above and click Save',
    ],
  },
  salesforce: {
    name: 'Salesforce', icon: '☁️', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Connect your Salesforce org to sync leads, accounts, and opportunities.',
    docsUrl: 'https://developer.salesforce.com/docs',
    authType: 'oauth',
    fields: [
      { key: 'instance_url',  label: 'Instance URL',    type: 'url',      placeholder: 'https://yourorg.salesforce.com' },
      { key: 'client_id',     label: 'Connected App Client ID',     type: 'text',     placeholder: '3MVG9...' },
      { key: 'client_secret', label: 'Connected App Client Secret', type: 'password', placeholder: 'Your client secret' },
    ],
    syncOptions: [
      { key: 'leads',         label: 'Leads',           desc: 'Sync Salesforce Leads bidirectionally' },
      { key: 'opportunities', label: 'Opportunities',   desc: 'Mirror opportunities as pipeline deals' },
      { key: 'accounts',      label: 'Accounts',        desc: 'Pull account data for company enrichment' },
    ],
    setupSteps: [
      'Setup → App Manager → New Connected App',
      'Enable OAuth Settings, add callback URL: https://coovex.com/api/oauth/salesforce/callback',
      'Select scopes: api, refresh_token',
      'Copy Consumer Key (Client ID) and Consumer Secret above',
    ],
  },
  zoho: {
    name: 'Zoho CRM', icon: '🔵', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Import and sync leads, contacts, and deals from Zoho CRM.',
    docsUrl: 'https://www.zoho.com/crm/developer/docs/',
    authType: 'oauth',
    fields: [
      { key: 'client_id',     label: 'Client ID',     type: 'text',     placeholder: '1000.XXXXXXXXXXXX' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'Your Zoho client secret' },
      { key: 'data_center',   label: 'Data Center',   type: 'select',   options: ['.com', '.eu', '.in', '.com.au', '.jp'] },
    ],
    syncOptions: [
      { key: 'leads',    label: 'Leads',    desc: 'Sync Zoho leads' },
      { key: 'contacts', label: 'Contacts', desc: 'Import contacts' },
      { key: 'deals',    label: 'Deals',    desc: 'Sync deal pipeline' },
    ],
    setupSteps: [
      'Go to Zoho Developer Console → Add Client → Server-based Application',
      'Set redirect URI to https://coovex.com/api/oauth/zoho/callback',
      'Copy Client ID and Secret',
      'Select your data center region and save',
    ],
  },
  mailchimp: {
    name: 'Mailchimp', icon: '🐒', color: 'bg-yellow-900/30 border-yellow-800/40',
    description: 'Add CooVex leads to Mailchimp audiences and sync campaign stats.',
    docsUrl: 'https://mailchimp.com/developer/',
    authType: 'api_key',
    fields: [
      { key: 'api_key',    label: 'API Key',     type: 'password', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us1', hint: 'Account → Extras → API Keys → Create A Key' },
      { key: 'audience_id', label: 'Audience ID', type: 'text',     placeholder: 'abc123def', hint: 'Audience → Settings → Audience name and defaults → Audience ID' },
    ],
    syncOptions: [
      { key: 'add_leads',     label: 'Add Leads to Audience', desc: 'New CooVex leads added to Mailchimp audience' },
      { key: 'tags',          label: 'Sync Tags',             desc: 'Apply CooVex lead source as Mailchimp tag' },
      { key: 'campaign_stats',label: 'Campaign Stats',        desc: 'Pull open/click rates into CooVex analytics' },
    ],
    setupSteps: [
      'Log in to Mailchimp → Account → Extras → API Keys',
      'Click "Create A Key" and copy it',
      'Go to Audience → Settings to find your Audience ID',
      'Paste both above and save',
    ],
  },
  activecampaign: {
    name: 'ActiveCampaign', icon: '⚡', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Sync contacts and automate follow-up with ActiveCampaign.',
    docsUrl: 'https://developers.activecampaign.com/reference/overview',
    authType: 'api_key',
    fields: [
      { key: 'api_url', label: 'Account URL', type: 'url', placeholder: 'https://youraccountname.api-us1.com', hint: 'Settings → Developer → API Access' },
      { key: 'api_key', label: 'API Key',     type: 'password', placeholder: 'Your ActiveCampaign API key' },
    ],
    syncOptions: [
      { key: 'contacts', label: 'Contacts', desc: 'Add CooVex leads as AC contacts' },
      { key: 'lists',    label: 'Lists',    desc: 'Assign leads to AC lists by source' },
      { key: 'tags',     label: 'Tags',     desc: 'Apply pipeline stage as AC tags' },
    ],
    setupSteps: [
      'Log in to ActiveCampaign → Settings (gear icon) → Developer',
      'Find your API URL and Key under "API Access"',
      'Paste both above and save',
    ],
  },

  // ─── Email / Marketing ────────────────────────────────────────────────────
  sendgrid: {
    name: 'SendGrid', icon: '📧', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Send transactional and marketing emails. Sync lead activity to contact lists.',
    docsUrl: 'https://docs.sendgrid.com/api-reference',
    authType: 'api_key',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'SG.xxxxxxxxxxxxxxxxxxxxx', hint: 'Settings → API Keys → Create API Key' },
      { key: 'sender_email', label: 'Verified Sender Email', type: 'text', placeholder: 'you@yourdomain.com', hint: 'Must be verified in SendGrid' },
    ],
    syncOptions: [
      { key: 'leads_to_contacts', label: 'Leads → Contacts', desc: 'Add new CooVex leads as SendGrid contacts' },
      { key: 'list_sync',         label: 'List Sync',         desc: 'Assign leads to lists by lead source or stage' },
      { key: 'email_activity',    label: 'Email Activity',    desc: 'Pull open/click stats into CooVex analytics' },
    ],
    setupSteps: [
      'Log in to SendGrid → Settings → API Keys → Create API Key',
      'Set permissions to "Full Access" or "Marketing" + "Mail Send"',
      'Copy the key (only shown once) and paste above',
      'Verify your sender email under Settings → Sender Authentication',
    ],
  },
  klaviyo: {
    name: 'Klaviyo', icon: '📬', color: 'bg-green-900/30 border-green-800/40',
    description: 'Sync leads to Klaviyo profiles and trigger automations from CooVex events.',
    docsUrl: 'https://developers.klaviyo.com/en',
    authType: 'api_key',
    fields: [
      { key: 'private_api_key', label: 'Private API Key', type: 'password', placeholder: 'pk_xxxxxxxxxxxxxxxxxxx', hint: 'Account → Settings → API Keys → Create Private API Key' },
      { key: 'public_api_key',  label: 'Public API Key (Site ID)', type: 'text', placeholder: 'XXXXXX', hint: 'Account → Settings → API Keys' },
    ],
    syncOptions: [
      { key: 'profiles',   label: 'Leads → Profiles', desc: 'Push CooVex leads to Klaviyo profiles' },
      { key: 'lists',      label: 'List Assignment',  desc: 'Add profiles to Klaviyo lists by segment' },
      { key: 'events',     label: 'Event Tracking',   desc: 'Track deal stage changes as Klaviyo events' },
    ],
    setupSteps: [
      'Log in to Klaviyo → Account (bottom left) → Settings → API Keys',
      'Create a Private API Key with full access',
      'Copy both your Private Key and Public Key (Site ID)',
      'Paste above and save',
    ],
  },
  brevo: {
    name: 'Brevo', icon: '💌', color: 'bg-teal-900/30 border-teal-800/40',
    description: 'Formerly Sendinblue. Sync contacts and trigger transactional or marketing emails.',
    docsUrl: 'https://developers.brevo.com/docs',
    authType: 'api_key',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'xkeysib-xxxxxxxxxxxxxxxxxxxxx', hint: 'My account → SMTP & API → API Keys' },
    ],
    syncOptions: [
      { key: 'contacts',  label: 'Contacts Sync', desc: 'Push CooVex leads to Brevo contacts' },
      { key: 'lists',     label: 'List Sync',     desc: 'Segment contacts by lead source or stage' },
      { key: 'campaigns', label: 'Campaign Stats', desc: 'Pull email open/click rates into analytics' },
    ],
    setupSteps: [
      'Log in to Brevo → Top right menu → My Account → SMTP & API',
      'Click "API Keys" tab → Generate a new API key',
      'Copy the key and paste above',
      'Save and test connection',
    ],
  },

  // ─── Finance / Accounting ─────────────────────────────────────────────────
  quickbooks: {
    name: 'QuickBooks Online', icon: '💰', color: 'bg-green-900/30 border-green-800/40',
    description: 'Sync revenue data from QBO invoices and track financial KPIs in CooVex.',
    docsUrl: 'https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice',
    authType: 'oauth',
    fields: [
      { key: 'client_id',     label: 'App Client ID',     type: 'text',     placeholder: 'ABxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'client_secret', label: 'App Client Secret', type: 'password', placeholder: 'Your QBO app secret' },
      { key: 'realm_id',      label: 'Company ID (Realm ID)', type: 'text', placeholder: '1234567890123456', hint: 'Shown in QBO URL: qbo.intuit.com/app/homepage?&companyId=...' },
    ],
    syncOptions: [
      { key: 'invoices',  label: 'Invoices',       desc: 'Pull paid/overdue invoices as revenue signals' },
      { key: 'customers', label: 'Customers',      desc: 'Sync QBO customers as CooVex leads' },
      { key: 'revenue',   label: 'Revenue KPIs',   desc: 'Track MRR, ARR, and revenue trend in dashboard' },
    ],
    setupSteps: [
      'Go to developer.intuit.com → Dashboard → Create an app → QuickBooks Online',
      'Set redirect URI to https://coovex.com/api/oauth/quickbooks/callback',
      'Copy Client ID and Client Secret from Keys & credentials',
      'Find your Company ID in your QBO URL and paste above',
    ],
  },
  xero: {
    name: 'Xero', icon: '💹', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Pull invoice and revenue data from Xero to power CooVex financial tracking.',
    docsUrl: 'https://developer.xero.com/documentation/api/api-overview',
    authType: 'oauth',
    fields: [
      { key: 'client_id',     label: 'Client ID',     type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'Your Xero client secret' },
    ],
    syncOptions: [
      { key: 'invoices',  label: 'Invoices',     desc: 'Sync paid/outstanding invoices as signals' },
      { key: 'contacts',  label: 'Contacts',     desc: 'Import Xero contacts as CooVex leads' },
      { key: 'cashflow',  label: 'Cash Flow KPI', desc: 'Show cash position in business health score' },
    ],
    setupSteps: [
      'Go to developer.xero.com → My Apps → New App → Web app',
      'Set redirect URI to https://coovex.com/api/oauth/xero/callback',
      'Select scopes: accounting.transactions.read, accounting.contacts.read',
      'Copy Client ID and Secret above and save',
    ],
  },

  // ─── E-commerce ──────────────────────────────────────────────────────────
  shopify: {
    name: 'Shopify', icon: '🛍️', color: 'bg-green-900/30 border-green-800/40',
    description: 'Pull orders, customers, and revenue data from your Shopify store.',
    docsUrl: 'https://shopify.dev/docs/api/admin-rest',
    authType: 'api_key',
    fields: [
      { key: 'store_url', label: 'Store URL', type: 'url', placeholder: 'https://yourstore.myshopify.com', hint: 'Your Shopify store admin URL' },
      { key: 'api_key',   label: 'API Key',   type: 'text',     placeholder: 'Your Shopify Admin API key' },
      { key: 'api_secret',label: 'API Secret',type: 'password', placeholder: 'Your Shopify Admin API secret key', hint: 'Apps → Your App → API credentials' },
    ],
    syncOptions: [
      { key: 'orders',     label: 'Orders',     desc: 'Pull recent orders and revenue into CooVex' },
      { key: 'customers',  label: 'Customers',  desc: 'Sync Shopify customers as leads' },
      { key: 'products',   label: 'Products',   desc: 'Track top-selling products and inventory signals' },
    ],
    setupSteps: [
      'In Shopify Admin → Settings → Apps and sales channels → Develop apps → Create an app',
      'Configure Admin API access scopes: read_orders, read_customers, read_products',
      'Install the app and copy your API key and Secret',
      'Paste your store URL, API key, and secret above',
    ],
  },
  woocommerce: {
    name: 'WooCommerce', icon: '🛒', color: 'bg-purple-900/30 border-purple-800/40',
    description: 'Connect your WooCommerce store to track sales, orders, and customer signals.',
    docsUrl: 'https://woocommerce.github.io/woocommerce-rest-api-docs/',
    authType: 'api_key',
    fields: [
      { key: 'store_url',      label: 'Store URL',       type: 'url',      placeholder: 'https://yoursite.com' },
      { key: 'consumer_key',   label: 'Consumer Key',    type: 'text',     placeholder: 'ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'WP Admin → WooCommerce → Settings → Advanced → REST API → Add Key' },
      { key: 'consumer_secret',label: 'Consumer Secret', type: 'password', placeholder: 'cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
    ],
    syncOptions: [
      { key: 'orders',    label: 'Orders',    desc: 'Pull WooCommerce orders as revenue signals' },
      { key: 'customers', label: 'Customers', desc: 'Sync customers as CooVex leads' },
      { key: 'reviews',   label: 'Reviews',   desc: 'Pull product reviews into review monitoring' },
    ],
    setupSteps: [
      'In WordPress Admin → WooCommerce → Settings → Advanced → REST API',
      'Click "Add Key" → set permissions to "Read/Write"',
      'Copy Consumer Key and Consumer Secret',
      'Paste your site URL and both keys above, then save',
    ],
  },

  // ─── Review Platforms ────────────────────────────────────────────────────
  trustpilot: {
    name: 'Trustpilot', icon: '⭐', color: 'bg-green-900/30 border-green-800/40',
    description: 'Monitor and respond to Trustpilot reviews from inside CooVex.',
    docsUrl: 'https://documentation.trustpilot.com/consumer-api',
    authType: 'api_key',
    fields: [
      { key: 'api_key',      label: 'API Key',      type: 'password', placeholder: 'Your Trustpilot Business Unit API key' },
      { key: 'business_unit_id', label: 'Business Unit ID', type: 'text', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Found in your Trustpilot Business URL' },
    ],
    syncOptions: [
      { key: 'monitor',   label: 'Monitor Reviews', desc: 'Pull new reviews and ratings daily' },
      { key: 'replies',   label: 'Reply Drafts',    desc: 'Generate AI reply drafts for reviews in CooVex' },
      { key: 'alerts',    label: 'Low-score Alerts',desc: 'Get agent signals when rating drops below 4.0' },
    ],
    setupSteps: [
      'Log in to Trustpilot Business → Integrations → API',
      'Create a new app and copy your API key',
      'Find your Business Unit ID in the URL: businessapp.trustpilot.com/reviews/XXXXXXXX',
      'Paste both above and save',
    ],
  },
  g2: {
    name: 'G2', icon: '🏅', color: 'bg-red-900/30 border-red-800/40',
    description: 'Track G2 reviews, ratings, and competitor comparison data.',
    docsUrl: 'https://data.g2.com/api/docs',
    authType: 'api_key',
    fields: [
      { key: 'api_key',    label: 'G2 Data API Key', type: 'password', placeholder: 'Your G2 API token', hint: 'Available for G2 Buyer Intent subscribers' },
      { key: 'product_id', label: 'Product ID',      type: 'text', placeholder: 'your-product-slug', hint: 'From your G2 product page URL' },
    ],
    syncOptions: [
      { key: 'reviews',    label: 'Review Sync',    desc: 'Pull G2 reviews into CooVex review hub' },
      { key: 'competitors',label: 'Competitor Intel',desc: 'Compare ratings vs competitors tracked in CooVex' },
      { key: 'intent',     label: 'Buyer Intent',   desc: 'Surface accounts researching your category as leads' },
    ],
    setupSteps: [
      'Log in to G2 → Data API access is available via G2 Buyer Intent plan',
      'Go to Settings → Integrations → API and generate your API token',
      'Find your product slug in your G2 profile URL: g2.com/products/[slug]',
      'Paste both above and save',
    ],
  },

  // ─── Social / Video ──────────────────────────────────────────────────────
  tiktok: {
    name: 'TikTok Business', icon: '🎵', color: 'bg-slate-800/60 border-slate-700/40',
    description: 'Track TikTok video performance, follower growth, and ad campaigns.',
    docsUrl: 'https://business-api.tiktok.com/portal/docs',
    authType: 'oauth',
    fields: [
      { key: 'app_id',     label: 'App ID',     type: 'text',     placeholder: 'Your TikTok app ID' },
      { key: 'app_secret', label: 'App Secret', type: 'password', placeholder: 'Your TikTok app secret' },
      { key: 'advertiser_id', label: 'Advertiser ID (for Ads)', type: 'text', placeholder: '7012345678901234567', hint: 'Optional — only needed for ad tracking' },
    ],
    syncOptions: [
      { key: 'content',    label: 'Content Analytics', desc: 'Views, likes, shares, comments per video' },
      { key: 'followers',  label: 'Follower Growth',   desc: 'Track follower trends over time' },
      { key: 'ads',        label: 'Ad Campaigns',      desc: 'Pull TikTok Ads spend and ROAS data' },
    ],
    setupSteps: [
      'Go to TikTok for Developers → My Apps → Create App',
      'Set redirect URI to https://coovex.com/api/oauth/tiktok/callback',
      'Enable scopes: user.info.basic, video.list, research.data.basic',
      'Copy App ID and Secret above, then save',
    ],
  },

  // ─── Social (OAuth setup) ────────────────────────────────────────────────
  linkedin: {
    name: 'LinkedIn', icon: '💼', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Publish posts to your LinkedIn profile and company page. Monitor analytics and profile views.',
    docsUrl: 'https://learn.microsoft.com/en-us/linkedin/marketing/getting-started',
    authType: 'oauth',
    fields: [
      { key: 'client_id',     label: 'App Client ID',     type: 'text',     placeholder: '86xxxxxxxxxx', hint: 'LinkedIn Developer Portal → Your App → Auth → Client ID' },
      { key: 'client_secret', label: 'App Client Secret', type: 'password', placeholder: 'Your app client secret' },
    ],
    syncOptions: [
      { key: 'posts',     label: 'Post Publishing', desc: 'Publish CooVex content drafts to LinkedIn' },
      { key: 'analytics', label: 'Post Analytics',  desc: 'Pull likes, impressions, and click data per post' },
      { key: 'profile',   label: 'Profile Views',   desc: 'Track profile view trends and follower growth' },
    ],
    setupSteps: [
      'Go to linkedin.com/developers → Create app → link to your LinkedIn Company Page',
      'Under "Auth" tab, add redirect URL: https://coovex.com/api/oauth/linkedin/callback',
      'Request products: "Share on LinkedIn" + "Sign In with LinkedIn using OpenID Connect"',
      'Copy Client ID and Client Secret above and save',
    ],
  },
  facebook: {
    name: 'Facebook', icon: '📘', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Manage Facebook Page posts, monitor comments, pull analytics and ad performance.',
    docsUrl: 'https://developers.facebook.com/docs/graph-api',
    authType: 'oauth',
    fields: [
      { key: 'app_id',      label: 'App ID',      type: 'text',     placeholder: '1234567890123456', hint: 'developers.facebook.com → Your App → App ID' },
      { key: 'app_secret',  label: 'App Secret',  type: 'password', placeholder: 'Your Facebook app secret' },
      { key: 'page_id',     label: 'Page ID',     type: 'text',     placeholder: '1234567890', hint: 'Facebook Page → About → Page ID' },
    ],
    syncOptions: [
      { key: 'posts',    label: 'Page Posts',   desc: 'Publish content and pull engagement stats' },
      { key: 'reviews',  label: 'Reviews',      desc: 'Monitor and respond to Facebook reviews' },
      { key: 'ads',      label: 'Ad Campaigns', desc: 'Pull Meta Ads performance data' },
    ],
    setupSteps: [
      'Go to developers.facebook.com → Create App → Business type',
      'Add Facebook Login product → set OAuth Redirect URI to https://coovex.com/api/oauth/facebook/callback',
      'Add Pages API permissions: pages_manage_posts, pages_read_engagement',
      'Copy App ID, App Secret, and your Page ID above',
    ],
  },
  instagram: {
    name: 'Instagram', icon: '📸', color: 'bg-pink-900/30 border-pink-800/40',
    description: 'Schedule Instagram posts, track engagement, and monitor mentions from CooVex.',
    docsUrl: 'https://developers.facebook.com/docs/instagram-api',
    authType: 'oauth',
    fields: [
      { key: 'app_id',      label: 'Meta App ID',     type: 'text',     placeholder: '1234567890123456', hint: 'Same Meta app as Facebook — App ID' },
      { key: 'app_secret',  label: 'Meta App Secret', type: 'password', placeholder: 'Your Meta app secret' },
      { key: 'ig_account_id', label: 'Instagram Business Account ID', type: 'text', placeholder: '17841400000000000', hint: 'Must be a Professional (Business/Creator) account linked to a Facebook Page' },
    ],
    syncOptions: [
      { key: 'posts',    label: 'Post Publishing', desc: 'Schedule and publish posts, reels, and carousels' },
      { key: 'insights', label: 'Insights',        desc: 'Reach, impressions, saves, profile visits per post' },
      { key: 'mentions', label: 'Mentions',        desc: 'Track and reply to @mentions and comments' },
    ],
    setupSteps: [
      'Use the same Meta App as your Facebook integration (or create one)',
      'Add Instagram Graph API product in your Meta Developer app',
      'Link your Instagram Professional account to a Facebook Page',
      'Get your Instagram Account ID via GET /me?fields=id from Graph API Explorer',
    ],
  },

  // ─── Messaging / Comms ───────────────────────────────────────────────────
  whatsapp: {
    name: 'WhatsApp Business', icon: '💬', color: 'bg-green-900/30 border-green-800/40',
    description: 'Send automated WhatsApp messages to leads and clients using the Business API.',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    authType: 'api_key',
    fields: [
      { key: 'phone_number_id', label: 'Phone Number ID',   type: 'text',     placeholder: '1234567890123456', hint: 'Meta Developer → WhatsApp → Getting Started → Phone Number ID' },
      { key: 'waba_id',         label: 'WhatsApp Business Account ID', type: 'text', placeholder: '1234567890123456', hint: 'Found in Meta Business Manager' },
      { key: 'access_token',    label: 'Permanent Access Token', type: 'password', placeholder: 'EAAxxxxxxxx…', hint: 'Meta Developer → WhatsApp → API Setup → generate permanent token' },
    ],
    syncOptions: [
      { key: 'lead_followup',   label: 'Lead Follow-up',   desc: 'Send WhatsApp messages when new leads come in' },
      { key: 'proposal_notify', label: 'Proposal Alerts',  desc: 'Notify clients when a proposal is ready' },
      { key: 'review_requests', label: 'Review Requests',  desc: 'Send review request links to happy customers' },
    ],
    setupSteps: [
      'Go to Meta for Developers → Create App → Business → add WhatsApp product',
      'In WhatsApp → Getting Started, add and verify your business phone number',
      'Generate a Permanent Access Token from System Users in Meta Business Manager',
      'Copy Phone Number ID, WABA ID, and Access Token above',
    ],
  },
  twilio: {
    name: 'Twilio (SMS)', icon: '📱', color: 'bg-red-900/30 border-red-800/40',
    description: 'Send SMS notifications and marketing messages to leads and customers via Twilio.',
    docsUrl: 'https://www.twilio.com/docs/sms/api',
    authType: 'api_key',
    fields: [
      { key: 'account_sid', label: 'Account SID',  type: 'text',     placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Twilio Console → Account Info' },
      { key: 'auth_token',  label: 'Auth Token',   type: 'password', placeholder: 'Your Twilio auth token' },
      { key: 'from_number', label: 'From Number',  type: 'text',     placeholder: '+1234567890', hint: 'Your Twilio phone number — must be SMS-capable' },
    ],
    syncOptions: [
      { key: 'sms_leads',   label: 'Lead SMS',     desc: 'Send SMS to new leads automatically' },
      { key: 'sms_alerts',  label: 'Agent Alerts', desc: 'Receive SMS when high-priority signals fire' },
      { key: 'sms_reviews', label: 'Review Requests', desc: 'SMS review invitations to satisfied clients' },
    ],
    setupSteps: [
      'Sign up at twilio.com → Console dashboard shows your Account SID and Auth Token',
      'Get a Twilio phone number under Phone Numbers → Buy a Number',
      'Ensure the number has SMS capability enabled',
      'Paste Account SID, Auth Token, and your Twilio number above',
    ],
  },
  slack: {
    name: 'Slack', icon: '💬', color: 'bg-purple-900/30 border-purple-800/40',
    description: 'Get AI agent alerts, new lead notifications, and daily briefs delivered to Slack channels.',
    docsUrl: 'https://api.slack.com/apps',
    authType: 'oauth',
    fields: [
      { key: 'bot_token',    label: 'Bot OAuth Token', type: 'password', placeholder: 'xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx', hint: 'api.slack.com → Your App → OAuth & Permissions → Bot User OAuth Token' },
      { key: 'channel_id',   label: 'Default Channel', type: 'text',     placeholder: 'C01XXXXXXXXX', hint: 'Right-click channel → Copy link — ID is at end of URL' },
      { key: 'signing_secret',label:'Signing Secret',  type: 'password', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'App → Basic Information → App Credentials → Signing Secret' },
    ],
    syncOptions: [
      { key: 'alerts',      label: 'Agent Signals',  desc: 'Post high-priority signals to your Slack channel' },
      { key: 'daily_brief', label: 'Daily Brief',    desc: 'Send morning AI brief to Slack at 8am' },
      { key: 'new_leads',   label: 'New Lead Alerts',desc: 'Notify channel when new leads come in' },
    ],
    setupSteps: [
      'Go to api.slack.com/apps → Create New App → From Scratch → name it "CooVex"',
      'Under OAuth & Permissions → Scopes add: chat:write, channels:read, channels:join',
      'Install app to workspace → copy Bot User OAuth Token',
      'Copy Signing Secret from Basic Information and your channel ID above',
    ],
  },
  teams: {
    name: 'Microsoft Teams', icon: '🟦', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Send CooVex agent alerts and reports to Microsoft Teams channels via webhooks.',
    docsUrl: 'https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook',
    authType: 'webhook',
    fields: [
      { key: 'webhook_url', label: 'Incoming Webhook URL', type: 'url', placeholder: 'https://yourorg.webhook.office.com/webhookb2/…', hint: 'Teams channel → ··· → Connectors → Incoming Webhook → Create' },
    ],
    syncOptions: [
      { key: 'alerts',      label: 'Agent Alerts',   desc: 'Post critical signals and actions to Teams' },
      { key: 'daily_brief', label: 'Daily Brief',    desc: 'Send morning AI summary to Teams channel' },
      { key: 'reports',     label: 'Weekly Reports', desc: 'Share AI-generated weekly report in Teams' },
    ],
    setupSteps: [
      'In Teams, go to the channel where you want to receive notifications',
      'Click ··· → Connectors → search "Incoming Webhook" → Configure',
      'Name it "CooVex", upload a logo if desired, click Create',
      'Copy the webhook URL and paste it above',
    ],
  },

  // ─── Calendar / Scheduling ───────────────────────────────────────────────
  calendly: {
    name: 'Calendly', icon: '📅', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Sync Calendly booking events as CooVex leads and activity log entries.',
    docsUrl: 'https://developer.calendly.com/api-docs',
    authType: 'api_key',
    fields: [
      { key: 'api_key',      label: 'Personal Access Token', type: 'password', placeholder: 'eyJra…', hint: 'Calendly Account → Integrations → API & Webhooks → Personal Access Tokens' },
      { key: 'organization_uri', label: 'Organization URI', type: 'text', placeholder: 'https://api.calendly.com/organizations/XXXXXXXX', hint: 'Returned by GET /users/me → current_organization' },
    ],
    syncOptions: [
      { key: 'bookings_to_leads', label: 'Bookings → Leads', desc: 'Create a CooVex lead for each new Calendly booking' },
      { key: 'cancellations',     label: 'Cancellations',    desc: 'Log cancellations as lead activity notes' },
      { key: 'meeting_reminders', label: 'Meeting Signals',  desc: 'Fire agent signals for upcoming meetings with leads' },
    ],
    setupSteps: [
      'Log in to Calendly → Integrations → API & Webhooks',
      'Click Personal Access Tokens → Generate New Token',
      'Call GET https://api.calendly.com/users/me with your token to find your Organization URI',
      'Paste token and Organization URI above',
    ],
  },
  google_calendar: {
    name: 'Google Calendar', icon: '🗓️', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Sync meetings with leads and clients from Google Calendar into CooVex activity timeline.',
    docsUrl: 'https://developers.google.com/calendar/api/v3/reference',
    authType: 'oauth',
    fields: [
      { key: 'client_id',     label: 'OAuth Client ID',     type: 'text',     placeholder: 'xxxxxxxxxxxx.apps.googleusercontent.com' },
      { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', placeholder: 'GOCSPX-xxxxxxxxxxxxxxxxxx' },
      { key: 'calendar_id',   label: 'Calendar ID',         type: 'text',     placeholder: 'primary', hint: 'Use "primary" for main calendar, or find ID in Calendar Settings → Integrate calendar' },
    ],
    syncOptions: [
      { key: 'meetings',    label: 'Meetings → Activity', desc: 'Log calendar events as lead activity notes' },
      { key: 'scheduling',  label: 'Schedule from Leads', desc: 'Create calendar events directly from lead detail page' },
      { key: 'reminders',   label: 'Meeting Signals',     desc: 'Agent signals for upcoming meetings with leads' },
    ],
    setupSteps: [
      'Go to Google Cloud Console → Enable Google Calendar API',
      'Create OAuth 2.0 credentials with redirect to https://coovex.com/api/oauth/google_calendar/callback',
      'Paste Client ID and Client Secret above',
      'Calendar ID "primary" syncs your main Google Calendar',
    ],
  },

  // ─── Google ──────────────────────────────────────────────────────────────
  google_ads: {
    name: 'Google Ads', icon: '💸', color: 'bg-yellow-900/30 border-yellow-800/40',
    description: 'Track campaign performance, ad spend, and conversions alongside your pipeline.',
    docsUrl: 'https://developers.google.com/google-ads/api/docs/start',
    authType: 'oauth',
    fields: [
      { key: 'developer_token', label: 'Developer Token', type: 'password', placeholder: 'Your Google Ads API developer token', hint: 'API Center in your Google Ads manager account' },
      { key: 'customer_id',     label: 'Customer ID',     type: 'text',     placeholder: '123-456-7890', hint: 'Top right of your Google Ads dashboard' },
      { key: 'login_customer_id', label: 'Manager Customer ID (MCC)', type: 'text', placeholder: '987-654-3210', hint: 'Only if using a manager account' },
    ],
    syncOptions: [
      { key: 'campaigns',   label: 'Campaign Stats', desc: 'Impressions, clicks, conversions, spend' },
      { key: 'conversions', label: 'Conversions',    desc: 'Map ad conversions to CooVex leads' },
      { key: 'spend',       label: 'Ad Spend KPI',   desc: 'Show total ad spend in business analytics' },
    ],
    setupSteps: [
      'Apply for Google Ads API access at developers.google.com/google-ads/api/docs/get-started/dev-token',
      'Set up a Google Cloud project and enable the Google Ads API',
      'Configure OAuth 2.0 credentials with redirect to https://coovex.com/api/oauth/google_ads/callback',
      'Copy your Developer Token and Customer ID above',
    ],
  },
  google_analytics: {
    name: 'Google Analytics 4', icon: '📊', color: 'bg-orange-900/30 border-orange-800/40',
    description: 'Pull website traffic, conversions, and audience data into CooVex dashboards.',
    docsUrl: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
    authType: 'oauth',
    fields: [
      { key: 'property_id', label: 'GA4 Property ID', type: 'text', placeholder: '123456789', hint: 'Admin → Property Settings → Property ID' },
      { key: 'client_id',     label: 'OAuth Client ID',     type: 'text',     placeholder: 'xxxxxxxxxxxx.apps.googleusercontent.com' },
      { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', placeholder: 'GOCSPX-xxxxxxxxxxxxxxxxxx' },
    ],
    syncOptions: [
      { key: 'traffic',     label: 'Traffic',     desc: 'Sessions, users, pageviews by source/medium' },
      { key: 'conversions', label: 'Conversions', desc: 'Goal completions mapped to lead sources' },
      { key: 'audience',    label: 'Audience',    desc: 'Demographics and device breakdown' },
    ],
    setupSteps: [
      'Go to Google Cloud Console → Create project → Enable Google Analytics Data API',
      'Create OAuth 2.0 credentials → set redirect to https://coovex.com/api/oauth/google_analytics/callback',
      'In Google Analytics → Admin → Property Settings copy your Property ID',
      'Paste Client ID, Client Secret, and Property ID above',
    ],
  },
  google_mybusiness: {
    name: 'Google Business Profile', icon: '📍', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Monitor reviews, Q&A, and profile insights from Google Business Profile.',
    docsUrl: 'https://developers.google.com/my-business/content/overview',
    authType: 'oauth',
    fields: [
      { key: 'client_id',     label: 'OAuth Client ID',     type: 'text',     placeholder: 'xxxxxxxxxxxx.apps.googleusercontent.com' },
      { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', placeholder: 'GOCSPX-xxxxxxxxxxxxxxxxxx' },
      { key: 'location_id',   label: 'Location ID',         type: 'text', placeholder: 'accounts/123/locations/456', hint: 'From the Business Profile API location resource name' },
    ],
    syncOptions: [
      { key: 'reviews',   label: 'Reviews',      desc: 'Pull Google reviews into CooVex review hub' },
      { key: 'insights',  label: 'Insights',     desc: 'Calls, directions, website clicks from profile' },
      { key: 'posts',     label: 'GBP Posts',    desc: 'Publish content posts to your GBP listing' },
    ],
    setupSteps: [
      'Go to Google Cloud Console → Enable the "My Business Business Information API" and "My Business Account Management API"',
      'Create OAuth 2.0 credentials with redirect to https://coovex.com/api/oauth/google_mybusiness/callback',
      'After connecting, your Location ID will be fetched automatically',
      'Paste Client ID and Client Secret above to get started',
    ],
  },
  google_search_console: {
    name: 'Google Search Console', icon: '🔍', color: 'bg-green-900/30 border-green-800/40',
    description: 'Track keyword rankings, impressions, and click-through rates from Google Search.',
    docsUrl: 'https://developers.google.com/webmaster-tools/v1/api_reference_index',
    authType: 'oauth',
    fields: [
      { key: 'site_url',      label: 'Site URL',            type: 'url',      placeholder: 'https://yourdomain.com', hint: 'Must match exactly how it appears in Search Console' },
      { key: 'client_id',     label: 'OAuth Client ID',     type: 'text',     placeholder: 'xxxxxxxxxxxx.apps.googleusercontent.com' },
      { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', placeholder: 'GOCSPX-xxxxxxxxxxxxxxxxxx' },
    ],
    syncOptions: [
      { key: 'keywords',   label: 'Top Keywords',  desc: 'Track keywords driving organic search traffic' },
      { key: 'pages',      label: 'Top Pages',     desc: 'See which pages rank and get clicks' },
      { key: 'ctr',        label: 'CTR & Position',desc: 'Monitor avg position and click-through-rate trends' },
    ],
    setupSteps: [
      'Go to Google Cloud Console → Enable the "Google Search Console API"',
      'Create OAuth 2.0 credentials with redirect to https://coovex.com/api/oauth/search_console/callback',
      'Paste Client ID and Secret above',
      'Your site must be verified in Search Console for data to appear',
    ],
  },

  // ─── ERP / Enterprise ───────────────────────────────────────────────────
  odoo: {
    name: 'Odoo', icon: '🟣', color: 'bg-purple-900/30 border-purple-800/40',
    description: 'Connect your Odoo CRM and ERP to sync leads, opportunities, and invoices.',
    docsUrl: 'https://www.odoo.com/documentation/17.0/developer/reference/external_api.html',
    authType: 'api_key',
    fields: [
      { key: 'url',       label: 'Odoo Instance URL', type: 'url',      placeholder: 'https://yourcompany.odoo.com' },
      { key: 'database',  label: 'Database Name',     type: 'text',     placeholder: 'yourcompany', hint: 'Shown in URL or Settings → General Settings' },
      { key: 'username',  label: 'Username (email)',  type: 'text',     placeholder: 'admin@yourcompany.com' },
      { key: 'api_key',   label: 'API Key',           type: 'password', placeholder: 'Your Odoo API key', hint: 'Settings → Users → your user → API Keys' },
    ],
    syncOptions: [
      { key: 'leads',    label: 'CRM Leads',    desc: 'Sync Odoo CRM leads and opportunities' },
      { key: 'invoices', label: 'Invoices',     desc: 'Pull revenue data from Odoo invoices' },
      { key: 'contacts', label: 'Contacts',     desc: 'Import Odoo contacts as CooVex leads' },
    ],
    setupSteps: [
      'In Odoo go to Settings → Users → select your user → API Keys',
      'Click "New API Key", name it "CooVex", copy the key',
      'Note your database name (shown in General Settings)',
      'Paste your instance URL, database, username, and API key above',
    ],
  },
  sap: {
    name: 'SAP Business One', icon: '🔷', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Connect SAP B1 to pull sales orders, partner data, and financial signals.',
    docsUrl: 'https://help.sap.com/docs/SAP_BUSINESS_ONE/e9f0734ada164c4a91ed0b84bdb6d35f/bfdecb94-ed85-4ff9-aa46-0d84ee76dcc8.html',
    authType: 'api_key',
    fields: [
      { key: 'service_layer_url', label: 'Service Layer URL', type: 'url', placeholder: 'https://sap-server:50000/b1s/v1', hint: 'SAP Business One Service Layer endpoint' },
      { key: 'company_db',  label: 'Company Database', type: 'text',     placeholder: 'SBODemoGB' },
      { key: 'username',    label: 'SAP Username',     type: 'text',     placeholder: 'manager' },
      { key: 'password',    label: 'SAP Password',     type: 'password', placeholder: 'Your SAP login password' },
    ],
    syncOptions: [
      { key: 'orders',    label: 'Sales Orders', desc: 'Pull open/closed orders as revenue signals' },
      { key: 'partners',  label: 'Business Partners', desc: 'Import customers as CooVex leads' },
      { key: 'invoices',  label: 'A/R Invoices', desc: 'Track invoice status for revenue analytics' },
    ],
    setupSteps: [
      'Ensure SAP B1 Service Layer is installed and accessible on your network',
      'Create a dedicated integration user with read access to Sales, BP, and Finance modules',
      'Note your Service Layer URL (format: https://server:50000/b1s/v1)',
      'Paste the URL, company database name, username, and password above',
    ],
  },
  oracle: {
    name: 'Oracle NetSuite', icon: '🔴', color: 'bg-red-900/30 border-red-800/40',
    description: 'Pull financials, CRM records, and sales data from Oracle NetSuite ERP.',
    docsUrl: 'https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1558159945.html',
    authType: 'oauth',
    fields: [
      { key: 'account_id',    label: 'Account ID',    type: 'text',     placeholder: '1234567', hint: 'NetSuite URL: system.netsuite.com/app/login → Account ID shown on login page' },
      { key: 'consumer_key',  label: 'Consumer Key',  type: 'text',     placeholder: 'Your integration consumer key' },
      { key: 'consumer_secret',label:'Consumer Secret',type:'password', placeholder: 'Your integration consumer secret' },
      { key: 'token_id',      label: 'Token ID',      type: 'text',     placeholder: 'Your access token ID' },
      { key: 'token_secret',  label: 'Token Secret',  type: 'password', placeholder: 'Your access token secret' },
    ],
    syncOptions: [
      { key: 'customers',  label: 'Customers',       desc: 'Import NetSuite customers as CooVex leads' },
      { key: 'revenue',    label: 'Revenue & KPIs',  desc: 'Pull MRR and ARR from NetSuite financials' },
      { key: 'leads',      label: 'CRM Leads',       desc: 'Sync NetSuite CRM leads bidirectionally' },
    ],
    setupSteps: [
      'In NetSuite: Setup → Integration → Manage Integrations → New → enable Token-Based Authentication',
      'Create Integration record, copy Consumer Key and Secret',
      'Setup → Users/Roles → Access Tokens → New → copy Token ID and Secret',
      'Paste all five credentials above',
    ],
  },
  dynamics365: {
    name: 'Microsoft Dynamics 365', icon: '🪟', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Sync Dynamics 365 Sales leads, opportunities, and accounts with CooVex.',
    docsUrl: 'https://docs.microsoft.com/en-us/dynamics365/customer-engagement/developer/use-microsoft-dynamics-365-web-api',
    authType: 'oauth',
    fields: [
      { key: 'tenant_id',     label: 'Azure Tenant ID',     type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', hint: 'Azure Portal → Azure Active Directory → Overview' },
      { key: 'client_id',     label: 'App (Client) ID',     type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'client_secret', label: 'Client Secret',       type: 'password', placeholder: 'Your Azure app client secret' },
      { key: 'resource_url',  label: 'Dynamics Org URL',    type: 'url',      placeholder: 'https://yourorg.crm.dynamics.com' },
    ],
    syncOptions: [
      { key: 'leads',         label: 'Leads',         desc: 'Sync Dynamics leads and contacts' },
      { key: 'opportunities', label: 'Opportunities', desc: 'Mirror Dynamics opportunities in CooVex pipeline' },
      { key: 'accounts',      label: 'Accounts',      desc: 'Import company accounts for enrichment' },
    ],
    setupSteps: [
      'Azure Portal → App registrations → New registration',
      'Add API permission: Dynamics CRM → user_impersonation',
      'Create a client secret under Certificates & secrets',
      'Paste Tenant ID, Client ID, Client Secret, and your Dynamics org URL above',
    ],
  },

  // ─── Automation ──────────────────────────────────────────────────────────
  zapier: {
    name: 'Zapier', icon: '⚡', color: 'bg-orange-900/30 border-orange-800/40',
    description: 'Trigger Zaps from CooVex events (new lead, stage change, new signal) using outbound webhooks.',
    docsUrl: 'https://zapier.com/apps/webhook/integrations',
    authType: 'webhook',
    fields: [
      { key: 'webhook_url', label: 'Zapier Webhook URL', type: 'url', placeholder: 'https://hooks.zapier.com/hooks/catch/xxxxxxx/xxxxxxx/', hint: 'Zapier → New Zap → Trigger: Webhooks by Zapier → Catch Hook → copy URL' },
    ],
    syncOptions: [
      { key: 'new_lead',    label: 'New Lead',         desc: 'Fire Zap when a new lead is created in CooVex' },
      { key: 'stage_change',label: 'Stage Change',     desc: 'Fire Zap when a lead stage changes' },
      { key: 'new_signal',  label: 'New Agent Signal', desc: 'Fire Zap when the AI agent generates a signal' },
    ],
    setupSteps: [
      'In Zapier, create a new Zap → Choose trigger: "Webhooks by Zapier" → "Catch Hook"',
      'Copy the webhook URL shown and paste it above',
      'Select which events should trigger your Zap',
      'Save — CooVex will POST JSON to your Zap URL for each selected event',
    ],
  },
  make: {
    name: 'Make (Integromat)', icon: '🔗', color: 'bg-purple-900/30 border-purple-800/40',
    description: 'Connect CooVex to 1,000+ apps via Make scenarios using outbound webhooks.',
    docsUrl: 'https://www.make.com/en/help/tools/webhooks',
    authType: 'webhook',
    fields: [
      { key: 'webhook_url', label: 'Make Webhook URL', type: 'url', placeholder: 'https://hook.eu1.make.com/xxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Make → Scenarios → Add Module: Webhooks → Custom Webhook → copy URL' },
    ],
    syncOptions: [
      { key: 'new_lead',    label: 'New Lead',         desc: 'Trigger Make scenario when a new lead arrives' },
      { key: 'stage_change',label: 'Stage Change',     desc: 'Trigger scenario on lead stage update' },
      { key: 'new_post',    label: 'New Content Post', desc: 'Trigger scenario when a post is created' },
    ],
    setupSteps: [
      'In Make, create a new Scenario → Add a module → search "Webhooks" → Custom Webhook',
      'Click "Add" → name it "CooVex" → click Save — copy the webhook URL',
      'Paste the URL above and choose which CooVex events should trigger it',
      'Save — test by clicking "Run once" in Make and triggering an event in CooVex',
    ],
  },

  // ─── Productivity ────────────────────────────────────────────────────────
  monday: {
    name: 'Monday.com', icon: '📋', color: 'bg-red-900/30 border-red-800/40',
    description: 'Sync CooVex leads and tasks to Monday.com boards for team project management.',
    docsUrl: 'https://developer.monday.com/apps/docs/mondayapi',
    authType: 'api_key',
    fields: [
      { key: 'api_key', label: 'API Token', type: 'password', placeholder: 'Your Monday.com personal API token', hint: 'Profile Photo → Developers → My Access Tokens' },
      { key: 'board_id', label: 'Target Board ID', type: 'text', placeholder: '1234567890', hint: 'From the board URL: monday.com/boards/[ID]' },
    ],
    syncOptions: [
      { key: 'leads_to_items', label: 'Leads → Board Items', desc: 'Push new CooVex leads as Monday.com board items' },
      { key: 'status_sync',    label: 'Stage Sync',          desc: 'Update Monday item status when lead stage changes' },
      { key: 'tasks',          label: 'Task Creation',       desc: 'Create Monday tasks from CooVex agent action items' },
    ],
    setupSteps: [
      'In Monday.com click your profile photo → Developers → My Access Tokens',
      'Copy your personal API token',
      'Find your board ID in the URL when viewing a board',
      'Paste both above and save',
    ],
  },
  notion: {
    name: 'Notion', icon: '📓', color: 'bg-slate-700/50 border-slate-600/40',
    description: 'Sync leads, reports, and agent insights to your Notion workspace.',
    docsUrl: 'https://developers.notion.com/reference/intro',
    authType: 'api_key',
    fields: [
      { key: 'api_key',     label: 'Internal Integration Secret', type: 'password', placeholder: 'secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'notion.so/my-integrations → Create integration → copy "Internal Integration Token"' },
      { key: 'database_id', label: 'Database ID', type: 'text', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Open your Notion database → Share → Copy link → the ID is between last / and ?' },
    ],
    syncOptions: [
      { key: 'leads',    label: 'Leads → Database', desc: 'Push CooVex leads as Notion database rows' },
      { key: 'reports',  label: 'Report Sync',      desc: 'Create Notion pages from CooVex monthly reports' },
      { key: 'signals',  label: 'Agent Signals',    desc: 'Log AI agent signals as Notion entries' },
    ],
    setupSteps: [
      'Go to notion.so/my-integrations → New Integration → name it "CooVex"',
      'Copy the Internal Integration Token (Secret)',
      'Open your target database → ··· menu → Add connections → select your integration',
      'Copy the database ID from the page URL and paste above',
    ],
  },

  // ─── Website Publishing ───────────────────────────────────────────────────
  wordpress_publish: {
    name: 'WordPress (Auto-Publish)', icon: '🔵', color: 'bg-blue-900/30 border-blue-800/40',
    description: 'Publish blog posts directly to your WordPress site via the REST API. No plugin required.',
    docsUrl: 'https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/',
    authType: 'api_key',
    fields: [
      { key: 'site_url',     label: 'WordPress Site URL',   type: 'url',      placeholder: 'https://yourblog.com' },
      { key: 'username',     label: 'WordPress Username',   type: 'text',     placeholder: 'admin' },
      { key: 'app_password', label: 'Application Password', type: 'password', placeholder: 'xxxx xxxx xxxx xxxx xxxx xxxx', hint: 'WP Admin → Users → Your Profile → Application Passwords → Add New' },
      { key: 'default_status', label: 'Default Publish Status', type: 'select', options: ['publish', 'draft'], hint: 'publish = live immediately, draft = saved as draft' },
    ],
    syncOptions: [
      { key: 'auto_publish', label: 'Auto-Publish', desc: 'Publish approved content instantly to WordPress' },
      { key: 'as_draft',     label: 'Save as Draft', desc: 'Send to WordPress as draft for manual review' },
    ],
    setupSteps: [
      'Log in to your WordPress admin panel',
      'Go to Users → Your Profile → scroll down to "Application Passwords"',
      'Enter a name (e.g. "CooVex") and click Add New Application Password',
      'Copy the generated password and paste it above (spaces are OK)',
      'Click Test Connection to verify',
    ],
  },
  webhook_publish: {
    name: 'Webhook (Custom Site)', icon: '🔗', color: 'bg-slate-800/50 border-slate-600/40',
    description: 'Push published content to any website or CMS via a custom HTTP webhook endpoint.',
    docsUrl: 'https://docs.coovex.com/integrations/webhook',
    authType: 'webhook',
    fields: [
      { key: 'url',    label: 'Webhook Endpoint URL', type: 'url',      placeholder: 'https://yoursite.com/api/coovex-publish' },
      { key: 'secret', label: 'Signing Secret',       type: 'password', placeholder: 'Optional — used to verify payload signature', hint: 'CooVex adds X-CooVex-Signature header (HMAC-SHA256) when a secret is provided' },
    ],
    syncOptions: [
      { key: 'publish', label: 'Auto-Push on Publish', desc: 'POST to your endpoint when content is published' },
    ],
    setupSteps: [
      'Set up an HTTP endpoint on your server that accepts POST requests',
      'The payload will be JSON: { title, content (HTML), slug, meta_title, meta_description, tags, published_at }',
      'Optionally set a secret key — CooVex will include an HMAC-SHA256 signature in X-CooVex-Signature header',
      'Paste your endpoint URL above and click Test Connection',
    ],
  },
  ghost: {
    name: 'Ghost CMS', icon: '👻', color: 'bg-slate-800/50 border-slate-600/40',
    description: 'Publish posts directly to your Ghost blog using the Ghost Admin API.',
    docsUrl: 'https://ghost.org/docs/admin-api/',
    authType: 'api_key',
    fields: [
      { key: 'site_url',      label: 'Ghost Site URL',    type: 'url',      placeholder: 'https://yourblog.ghost.io' },
      { key: 'admin_api_key', label: 'Admin API Key',     type: 'password', placeholder: 'id:secret_hex', hint: 'Ghost Admin → Settings → Integrations → Add custom integration → copy Admin API Key' },
      { key: 'default_status', label: 'Default Status',  type: 'select',   options: ['published', 'draft'] },
    ],
    syncOptions: [
      { key: 'auto_publish', label: 'Auto-Publish', desc: 'Publish immediately to Ghost' },
      { key: 'as_draft',     label: 'Save as Draft', desc: 'Send to Ghost as draft' },
    ],
    setupSteps: [
      'In Ghost Admin → Settings → Integrations → click "Add custom integration"',
      'Name it "CooVex" and click Create',
      'Copy the "Admin API Key" (format: id:secret)',
      'Paste your Ghost site URL and API key above',
      'Click Test Connection',
    ],
  },
  github: {
    name: 'GitHub (Jamstack / Static Site)', icon: '🐙', color: 'bg-slate-800/50 border-slate-600/40',
    description: 'Commit content as Markdown or HTML files to a GitHub repo. Works with Hugo, Jekyll, Next.js, Astro, and any Jamstack setup.',
    docsUrl: 'https://docs.github.com/en/rest/repos/contents',
    authType: 'api_key',
    fields: [
      { key: 'token',        label: 'GitHub Personal Access Token', type: 'password', placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx', hint: 'github.com → Settings → Developer settings → Personal access tokens → Fine-grained → repo:write' },
      { key: 'owner',        label: 'Repo Owner',    type: 'text', placeholder: 'yourusername or org-name' },
      { key: 'repo',         label: 'Repository',   type: 'text', placeholder: 'my-blog-site' },
      { key: 'branch',       label: 'Branch',        type: 'text', placeholder: 'main', hint: 'Branch to commit to (default: main)' },
      { key: 'content_path', label: 'Content Path',  type: 'text', placeholder: 'content/blog', hint: 'Folder path inside the repo where posts will be saved' },
      { key: 'file_format',  label: 'File Format',   type: 'select', options: ['markdown', 'html'], hint: 'markdown includes frontmatter (title, date, tags, etc.)' },
    ],
    syncOptions: [
      { key: 'auto_commit', label: 'Auto-Commit on Publish', desc: 'Commit new post file when content is published' },
    ],
    setupSteps: [
      'Go to github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens',
      'Create a token with Repository access → Contents: Read and write',
      'Copy the token and paste above',
      'Enter your repo owner (username or org), repo name, branch (usually main), and the folder where posts should go',
      'Click Test Connection to verify access',
    ],
  },
  sftp: {
    name: 'SFTP (Server Upload)', icon: '🖥️', color: 'bg-slate-800/50 border-slate-600/40',
    description: 'Upload HTML or Markdown files directly to your web server via SFTP/SSH.',
    docsUrl: 'https://en.wikipedia.org/wiki/SSH_File_Transfer_Protocol',
    authType: 'api_key',
    fields: [
      { key: 'host',        label: 'SFTP Host',       type: 'text',     placeholder: 'server.yoursite.com or 123.456.789.0' },
      { key: 'port',        label: 'Port',            type: 'text',     placeholder: '22', hint: 'Default SFTP port is 22' },
      { key: 'username',    label: 'SSH Username',    type: 'text',     placeholder: 'ubuntu or root' },
      { key: 'password',    label: 'SSH Password',    type: 'password', placeholder: 'Leave empty if using private key' },
      { key: 'private_key', label: 'SSH Private Key (PEM)', type: 'textarea', placeholder: '-----BEGIN RSA PRIVATE KEY-----\n...', hint: 'Paste your private key or leave empty to use password auth' },
      { key: 'upload_path', label: 'Upload Path',     type: 'text',     placeholder: '/var/www/html/blog', hint: 'Absolute path on the server where files will be uploaded' },
      { key: 'file_format', label: 'File Format',     type: 'select',   options: ['html', 'markdown'] },
    ],
    syncOptions: [
      { key: 'auto_upload', label: 'Auto-Upload on Publish', desc: 'Upload file to server when content is published' },
    ],
    setupSteps: [
      'Get your server\'s hostname/IP, SSH username, and either a password or private key',
      'Make sure the upload path exists on your server (e.g. /var/www/html/blog)',
      'The SSH user needs write permission to that directory',
      'For private key auth: copy your .pem file contents into the Private Key field above',
      'Click Test Connection — CooVex will verify connectivity and confirm the upload path exists',
    ],
  },
}

export default function IntegrationConfigPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = use(params)
  const cfg = CONFIGS[type]

  const [fields, setFields] = useState<Record<string, string>>({})
  const [sync, setSync] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    // Load saved config from Supabase integrations table
    fetch(`/api/integrations/${type}`)
      .then(r => r.json())
      .then(d => {
        if (d.config) {
          setFields(d.config.credentials || {})
          setSync(d.config.sync_options || {})
        }
      })
      .catch(() => {})
  }, [type])

  async function save() {
    setSaving(true)
    setSaved(false)
    await fetch(`/api/integrations/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: fields, sync_options: sync }),
    }).catch(() => {})
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: type, settings: fields }),
      })
      const data = await res.json() as { ok: boolean; msg: string }
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, msg: 'Test request failed — check your network.' })
    } finally {
      setTesting(false)
    }
  }

  if (!cfg) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-slate-400">Integration &quot;{type}&quot; not configured yet.</p>
        <Link href="/integrations" className="text-violet-400 text-sm mt-2 inline-block">← Back to Integrations</Link>
      </div>
    )
  }

  const askAiUrl = `/chat?q=${encodeURIComponent(`Help me connect ${cfg.name} to CooVex. Walk me through the setup steps and explain what I need to find in my ${cfg.name} account.`)}`

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/integrations" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Integrations
        </Link>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-3xl ${cfg.color}`}>{cfg.icon}</div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{cfg.name}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{cfg.description}</p>
          </div>
          <a href={cfg.docsUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors flex-shrink-0">
            Official Docs <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ── Benefits — WHY connect ── */}
      <div className="bg-violet-950/20 border border-violet-800/30 rounded-2xl p-5 mb-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-violet-300 text-xs font-bold uppercase tracking-widest mb-1">Why connect {cfg.name}?</p>
            <p className="text-violet-200 text-sm font-medium">{cfg.benefit ?? cfg.description}</p>
          </div>
          <Link
            href={askAiUrl}
            className="flex-shrink-0 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            🤖 Ask AI to help
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {cfg.syncOptions.map(opt => (
            <div key={opt.key} className="flex items-start gap-2.5 bg-violet-950/30 border border-violet-800/20 rounded-xl p-3">
              <span className="text-violet-400 mt-0.5 text-sm">✓</span>
              <div>
                <p className="text-violet-200 text-xs font-semibold">{opt.label}</p>
                <p className="text-violet-400/70 text-xs mt-0.5">{opt.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {cfg.data_unlocked && cfg.data_unlocked.length > 0 && (
          <div className="mt-3 pt-3 border-t border-violet-800/20">
            <p className="text-violet-400/60 text-xs">Once connected, your AI agent can:</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {cfg.data_unlocked.map((item, i) => (
                <span key={i} className="text-[11px] px-2.5 py-1 bg-violet-900/30 text-violet-300 border border-violet-700/30 rounded-full">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── How to set up ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm">How to set up</h2>
          <Link
            href={askAiUrl}
            className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors"
          >
            🤖 Ask AI for help →
          </Link>
        </div>
        <div className="space-y-3">
          {cfg.setupSteps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-600/20 border border-violet-700/40 text-violet-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
          <p className="text-slate-500 text-xs">
            Stuck? <Link href={askAiUrl} className="text-violet-400 hover:text-violet-300 font-medium">Ask your AI agent</Link> — it can read the docs and walk you through each step based on your specific setup.
          </p>
        </div>
      </div>

      {/* Credentials */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5">
        <h2 className="text-white font-semibold text-sm mb-4">Credentials</h2>
        <div className="space-y-4">
          {cfg.fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs text-slate-400 mb-1.5">{f.label}</label>
              {f.type === 'select' ? (
                <select value={fields[f.key] || ''} onChange={e => setFields(flds => ({ ...flds, [f.key]: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors appearance-none">
                  <option value="">Select…</option>
                  {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  value={fields[f.key] || ''}
                  onChange={e => setFields(flds => ({ ...flds, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={5}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors font-mono resize-y"
                />
              ) : (
                <input
                  type={f.type}
                  value={fields[f.key] || ''}
                  onChange={e => setFields(flds => ({ ...flds, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              )}
              {f.hint && <p className="text-slate-600 text-xs mt-1">{f.hint}</p>}
            </div>
          ))}
        </div>

        {testResult && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${testResult.ok ? 'bg-emerald-900/30 border border-emerald-800/40 text-emerald-300' : 'bg-red-900/30 border border-red-800/40 text-red-300'}`}>
            {testResult.ok ? '✓ ' : '✗ '}{testResult.msg}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={testConnection} disabled={testing}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl border border-slate-700 transition-colors disabled:opacity-50">
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors ml-auto">
            {saved ? <><Check className="w-4 h-4" />Saved</> : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Sync options */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold text-sm mb-4">Sync Options</h2>
        <div className="space-y-3">
          {cfg.syncOptions.map(opt => (
            <label key={opt.key} className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={sync[opt.key] ?? true}
                onChange={e => setSync(s => ({ ...s, [opt.key]: e.target.checked }))}
                className="mt-0.5 accent-violet-500" />
              <div>
                <p className="text-white text-sm font-medium">{opt.label}</p>
                <p className="text-slate-500 text-xs">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
