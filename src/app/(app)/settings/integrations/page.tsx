import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EmbedSnippet from './embed-snippet'
import SocialSection from './social-section'
import OtherIntegrations from './other-integrations'
import DataImportSection from './data-import-section'
import WebsiteMetricsSection from './website-metrics-section'
import ContentPushSection from './content-push-section'

export const metadata: Metadata = { title: 'Integrations' }
export const dynamic = 'force-dynamic'

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coovex.com'

  let embedToken: string | null = null
  let socialConnections: Record<string, { connected: boolean; account_name?: string; pages?: { id: string; name: string }[] }> = {}
  let otherIntegrations: Record<string, { enabled?: boolean; [key: string]: unknown }> = {}

  try {
    const { data: business } = await supabase
      .from('businesses').select('*')
      .eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()

    if (business) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const biz = business as any
      embedToken = biz.embed_token ?? null
      socialConnections = biz.social_connections ?? {}
      otherIntegrations = biz.integrations ?? {}

      // Auto-generate embed_token if missing
      if (!embedToken) {
        const token = crypto.randomUUID().replace(/-/g, '')
        await supabase.from('businesses').update({ embed_token: token } as Record<string, unknown>).eq('id', biz.id)
        embedToken = token
      }
    }
  } catch {
    // DB columns may not exist yet — continue with empty state
  }

  const linkedinConfigured = !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)
  const facebookConfigured = !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-slate-400 text-sm mt-0.5">Connect social accounts and tools to publish and capture leads automatically</p>
      </div>

      <div className="space-y-8">

        {/* Content Push API */}
        <div id="content-push">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">Content Push API</h2>
          <ContentPushSection appUrl={appUrl} />
        </div>

        {/* Social Media Accounts */}
        <div id="social">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">Social Media Accounts</h2>
          <Suspense fallback={null}>
            <SocialSection
              connections={socialConnections}
              linkedinConfigured={linkedinConfigured}
              facebookConfigured={facebookConfigured}
            />
          </Suspense>
        </div>

        {/* Website Embed */}
        <div id="lead-capture">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">Lead Capture</h2>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 bg-violet-950/50 border border-violet-900/50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">💬</div>
              <div>
                <h3 className="text-white font-semibold">Website Lead Capture Widget</h3>
                <p className="text-slate-500 text-sm mt-0.5">Add a floating chat widget to your website to capture leads directly into CooVex CRM.</p>
              </div>
            </div>
            {embedToken ? (
              <EmbedSnippet token={embedToken} appUrl={appUrl} />
            ) : (
              <p className="text-slate-600 text-sm">No business found. Complete onboarding first.</p>
            )}
          </div>
        </div>

        {/* CRM & Finance — sync real revenue data */}
        <div id="crm">
          <div className="mb-3">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest">CRM & Finance</h2>
            <p className="text-slate-600 text-xs mt-1">Connect your CRM or accounting app to sync real revenue data into CooVex.</p>
          </div>
          <OtherIntegrations integrations={otherIntegrations} />
        </div>

        {/* Website / Product Metrics API */}
        <div id="ai-context">
          <div className="mb-3">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest">AI Business Context</h2>
            <p className="text-slate-600 text-xs mt-1">Push your real metrics (paying customers, MRR, DAU) so AI gives accurate goals and insights — not guesses.</p>
          </div>
          <WebsiteMetricsSection />
        </div>

        {/* Custom CRM webhook + CSV import */}
        <div id="manual-import">
          <div className="mb-3">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Custom CRM & Manual Import</h2>
            <p className="text-slate-600 text-xs mt-1">No CRM? Use a webhook or import a spreadsheet to get your revenue data into CooVex.</p>
          </div>
          <DataImportSection
            webhookUrl={embedToken
              ? `${appUrl}/api/integrations/webhook?token=${embedToken}`
              : `${appUrl}/api/integrations/webhook?token=<your_token>`}
          />
        </div>

      </div>
    </div>
  )
}
