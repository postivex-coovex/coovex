import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Integrations — CooVex' }
export const dynamic = 'force-dynamic'

const INTEGRATION_GROUPS = [
  {
    label: 'Social Media',
    integrations: [
      { type: 'linkedin',  name: 'LinkedIn',        icon: '💼', desc: 'Posts, company page analytics, profile monitoring',  href: '/settings/integrations#social', sourceKey: 'social' },
      { type: 'facebook',  name: 'Facebook',        icon: '📘', desc: 'Page posts, ads, messages, reviews',                 href: '/settings/integrations#social', sourceKey: 'social' },
      { type: 'instagram', name: 'Instagram',       icon: '📸', desc: 'Posts, stories, reels, insights',                   href: '/settings/integrations#social', sourceKey: 'social' },
      { type: 'tiktok',    name: 'TikTok Business', icon: '🎵', desc: 'Videos, analytics, ad campaigns',                   href: '/settings/integrations#social', sourceKey: 'social' },
    ],
  },
  {
    label: 'Messaging & Notifications',
    integrations: [
      { type: 'slack',    name: 'Slack',             icon: '💬', desc: 'Agent alerts, daily brief, lead notifications' },
      { type: 'teams',    name: 'Microsoft Teams',   icon: '🟦', desc: 'Webhook alerts and reports to Teams channels' },
      { type: 'whatsapp', name: 'WhatsApp Business', icon: '📲', desc: 'Automated lead follow-up and review requests' },
      { type: 'twilio',   name: 'Twilio (SMS)',       icon: '📱', desc: 'SMS alerts and marketing to leads and clients' },
    ],
  },
  {
    label: 'Scheduling',
    integrations: [
      { type: 'calendly',        name: 'Calendly',        icon: '📅', desc: 'Bookings become leads automatically' },
      { type: 'google_calendar', name: 'Google Calendar', icon: '🗓️', desc: 'Sync meetings to lead activity timeline' },
    ],
  },
  {
    label: 'Google',
    integrations: [
      { type: 'google_mybusiness',     name: 'Google Business Profile', icon: '📍', desc: 'Reviews, Q&A, posts, insights', sourceKey: 'other' },
      { type: 'google_analytics',      name: 'Google Analytics 4',      icon: '📊', desc: 'Website traffic, conversions, audience', sourceKey: 'other' },
      { type: 'google_search_console', name: 'Google Search Console',   icon: '🔍', desc: 'Keywords, impressions, click-through rates' },
      { type: 'google_ads',            name: 'Google Ads',              icon: '💸', desc: 'Campaign performance, spend, conversions', sourceKey: 'other' },
    ],
  },
  {
    label: 'CRM',
    integrations: [
      { type: 'hubspot',    name: 'HubSpot',    icon: '🧲', desc: 'Contacts, deals, pipeline sync', sourceKey: 'other' },
      { type: 'salesforce', name: 'Salesforce', icon: '☁️', desc: 'Full CRM and opportunity tracking' },
      { type: 'zoho',       name: 'Zoho CRM',   icon: '🔵', desc: 'Leads, contacts, deals management' },
      { type: 'pipedrive',  name: 'Pipedrive',  icon: '🎯', desc: 'Pipeline and deal tracking' },
    ],
  },
  {
    label: 'E-commerce',
    integrations: [
      { type: 'shopify',     name: 'Shopify',     icon: '🛍️', desc: 'Orders, products, customer insights' },
      { type: 'woocommerce', name: 'WooCommerce', icon: '🛒', desc: 'Sales, inventory, customer data' },
    ],
  },
  {
    label: 'Email & Marketing',
    integrations: [
      { type: 'mailchimp',      name: 'Mailchimp',      icon: '🐒', desc: 'Email lists, campaigns, open rates', sourceKey: 'other' },
      { type: 'activecampaign', name: 'ActiveCampaign', icon: '⚡', desc: 'Contacts, lists, automation sequences' },
      { type: 'sendgrid',       name: 'SendGrid',       icon: '📧', desc: 'Transactional and marketing email' },
      { type: 'klaviyo',        name: 'Klaviyo',        icon: '📬', desc: 'Profiles, lists, flow automation' },
      { type: 'brevo',          name: 'Brevo',          icon: '💌', desc: 'Email and SMS marketing contacts' },
    ],
  },
  {
    label: 'Finance & Accounting',
    integrations: [
      { type: 'quickbooks', name: 'QuickBooks Online', icon: '💰', desc: 'Invoices, customers, revenue KPIs' },
      { type: 'xero',       name: 'Xero',             icon: '💹', desc: 'Invoices, contacts, cash flow tracking' },
    ],
  },
  {
    label: 'ERP & Enterprise',
    integrations: [
      { type: 'odoo',       name: 'Odoo',                   icon: '🟣', desc: 'CRM leads, invoices, contacts' },
      { type: 'sap',        name: 'SAP Business One',       icon: '🔷', desc: 'Sales orders, partners, financials' },
      { type: 'oracle',     name: 'Oracle NetSuite',        icon: '🔴', desc: 'ERP, CRM, and financials sync' },
      { type: 'dynamics365',name: 'Microsoft Dynamics 365', icon: '🪟', desc: 'Leads, opportunities, accounts' },
    ],
  },
  {
    label: 'Reviews',
    integrations: [
      { type: 'trustpilot', name: 'Trustpilot', icon: '⭐', desc: 'Review monitoring and response' },
      { type: 'g2',         name: 'G2',         icon: '🏅', desc: 'Software reviews and buyer intent' },
    ],
  },
  {
    label: 'Productivity',
    integrations: [
      { type: 'monday', name: 'Monday.com', icon: '📋', desc: 'Lead boards, task tracking, status sync' },
      { type: 'notion', name: 'Notion',     icon: '📓', desc: 'Leads, reports, and signals to Notion' },
    ],
  },
  {
    label: 'Automation',
    integrations: [
      { type: 'zapier',    name: 'Zapier',    icon: '⚡', desc: 'Trigger Zaps from CooVex events',      sourceKey: 'other', href: '/integrations/zapier' },
      { type: 'make',      name: 'Make',      icon: '🔗', desc: 'Connect 1,000+ apps via Make scenarios', href: '/integrations/make' },
      { type: 'wordpress', name: 'WordPress', icon: '📝', desc: 'Capture leads via WP plugin embed',      href: '/integrations/wordpress' },
    ],
  },
]

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()

  // Connected types — built from two sources:
  // 1. businesses.social_connections JSONB  (linkedin/facebook/instagram/tiktok)
  // 2. businesses.integrations JSONB        (hubspot/mailchimp/ga4/google_ads/zapier)
  // 3. integrations table                   (legacy / other configs)
  const connectedTypes = new Set<string>()

  try {
    const { data: business } = profile?.current_workspace_id
      ? await supabase.from('businesses').select('*').eq('workspace_id', profile.current_workspace_id).maybeSingle()
      : { data: null }

    if (business) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const biz = business as any

      // Social connections
      const sc: Record<string, { connected?: boolean }> = biz.social_connections ?? {}
      for (const [platform, data] of Object.entries(sc)) {
        if (data?.connected) connectedTypes.add(platform)
      }

      // Other integrations (JSONB)
      const intg: Record<string, { enabled?: boolean; api_key?: string; access_token?: string }> = biz.integrations ?? {}
      for (const [platform, data] of Object.entries(intg)) {
        if (data?.enabled || data?.api_key || data?.access_token) connectedTypes.add(platform)
      }

      // Integrations table (legacy)
      const { data: tableIntg } = await supabase
        .from('integrations')
        .select('type, status')
        .eq('business_id', biz.id)
      for (const row of tableIntg ?? []) {
        if (row.status === 'connected' || row.status === 'active') connectedTypes.add(row.type)
      }
    }
  } catch {
    // columns may not exist yet — continue with empty set
  }

  const totalAvailable = INTEGRATION_GROUPS.reduce((sum, g) => sum + g.integrations.length, 0)
  const connectedCount = connectedTypes.size

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-slate-400 text-base mt-1">
          Connect your tools so your AI agent can monitor everything automatically.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-slate-500 text-sm mb-1">Connected</p>
          <p className={`text-4xl font-bold ${connectedCount > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
            {connectedCount}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-slate-500 text-sm mb-1">Available</p>
          <p className="text-4xl font-bold text-white">{totalAvailable}+</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-slate-500 text-sm mb-1">Sync Frequency</p>
          <p className="text-4xl font-bold text-white">24h</p>
        </div>
      </div>

      {connectedCount === 0 && (
        <div className="mb-8 bg-violet-950/20 border border-violet-800/30 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-violet-300 font-medium">No integrations connected yet</p>
            <p className="text-slate-500 text-sm mt-0.5">Start with social media — connect LinkedIn or Facebook to publish content directly.</p>
          </div>
          <Link href="/settings/integrations" className="flex-shrink-0 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            Get Started →
          </Link>
        </div>
      )}

      <div className="space-y-10">
        {INTEGRATION_GROUPS.map(group => (
          <div key={group.label}>
            <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider text-slate-500">{group.label}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.integrations.map(integration => {
                const isConnected = connectedTypes.has(integration.type)
                const href = (integration as { href?: string }).href ?? `/integrations/${integration.type}`
                return (
                  <div
                    key={integration.type}
                    className={`bg-slate-900 border rounded-2xl p-5 flex items-center gap-4 transition-colors ${
                      isConnected ? 'border-emerald-800/40 bg-emerald-950/10' : 'border-slate-800'
                    }`}
                  >
                    <div className="text-3xl flex-shrink-0">{integration.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-base">{integration.name}</p>
                      <p className="text-slate-500 text-sm truncate mt-0.5">{integration.desc}</p>
                    </div>
                    <Link
                      href={href}
                      className={`flex-shrink-0 text-sm font-medium px-4 py-2 rounded-xl border transition-colors ${
                        isConnected
                          ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-400 hover:bg-emerald-950/60'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-violet-500/50 hover:text-white'
                      }`}
                    >
                      {isConnected ? 'Connected ✓' : 'Configure →'}
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
