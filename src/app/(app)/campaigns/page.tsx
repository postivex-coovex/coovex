import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CampaignsClient from './campaigns-client'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let businessName = 'Your Business'
  let emailSettings: Record<string, string | boolean> = {}

  try {
    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (profile?.current_workspace_id) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('name, email_settings')
        .eq('workspace_id', profile.current_workspace_id)
        .maybeSingle()
      if (biz?.name) businessName = biz.name
      if (biz?.email_settings) emailSettings = biz.email_settings as Record<string, string | boolean>
    }
  } catch { /* ignore */ }

  return (
    <CampaignsClient
      businessName={businessName}
      emailSettings={emailSettings}
      serverResendReady={!!(process.env.RESEND_API_KEY)}
    />
  )
}
