import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { IntegrationsClient } from './integrations-client'

export default async function LeadIntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://coovex.com'
  const fbVerifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ?? 'coovex-fb-verify'
  const fbWebhookUrl = `${appUrl}/api/leads/webhook/facebook`

  let businessName = ''
  let webhookUrl = ''
  let facebookConnected = false

  try {
    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    const { data: business } = await supabase.from('businesses')
      .select('*')
      .eq('workspace_id', profile?.current_workspace_id ?? '')
      .maybeSingle()

    if (business) {
      const { generateWebhookToken } = await import('@/lib/webhook-token')
      const token = generateWebhookToken(business.id)
      businessName = business.name ?? ''
      webhookUrl = `${appUrl}/api/leads/webhook/${token}`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sc = (business as any).social_connections as Record<string, any> ?? {}
      facebookConnected = !!(sc.facebook?.connected)
    }
  } catch {
    // fail silently — page still renders without webhook URL
  }

  return (
    <IntegrationsClient
      businessName={businessName}
      webhookUrl={webhookUrl}
      appUrl={appUrl}
      facebookConnected={facebookConnected}
      fbWebhookUrl={fbWebhookUrl}
      fbVerifyToken={fbVerifyToken}
    />
  )
}
