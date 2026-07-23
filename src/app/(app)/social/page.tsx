import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SocialClient from './social-client'

export const metadata = { title: 'Social Autopilot — CooVex' }

const SOCIAL_CHANNELS = ['linkedin', 'facebook', 'reddit', 'x', 'youtube']

export default async function SocialPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name, industry, social_connections').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  const { data: posts } = business
    ? await supabase.from('posts')
        .select('id, channel, content, status, scheduled_at, published_at, created_at, slug')
        .eq('business_id', business.id)
        .in('channel', SOCIAL_CHANNELS)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] }

  const settings = (business?.social_connections as Record<string, { social_enabled?: boolean }>) ?? {}

  return (
    <Suspense>
      <SocialClient
        platform="summary"
        posts={posts ?? []}
        businessName={business?.name ?? ''}
        industry={business?.industry ?? ''}
        settings={settings}
      />
    </Suspense>
  )
}
