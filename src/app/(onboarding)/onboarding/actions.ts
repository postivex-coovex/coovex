'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile?.current_workspace_id) throw new Error('No workspace found')

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('workspace_id', profile.current_workspace_id)
    .maybeSingle()

  return { supabase, user, workspaceId: profile.current_workspace_id, businessId: business?.id as string | undefined }
}

export interface BusinessFormData {
  name: string
  industry: string
  size: string
  target_customer: string
  country: string
  website_url?: string
  description?: string
}

export async function saveBusiness(data: BusinessFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile?.current_workspace_id) throw new Error('No workspace')

  const { data: existing } = await supabase
    .from('businesses')
    .select('id')
    .eq('workspace_id', profile.current_workspace_id)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('businesses')
      .update({
        name: data.name,
        industry: data.industry,
        size: data.size,
        target_customer: data.target_customer,
        country: data.country,
        website_url: data.website_url || null,
        description: data.description || null,
      })
      .eq('id', existing.id)
  } else {
    const { error } = await supabase
      .from('businesses')
      .insert({
        workspace_id: profile.current_workspace_id,
        name: data.name,
        industry: data.industry,
        size: data.size,
        target_customer: data.target_customer,
        country: data.country,
        website_url: data.website_url || null,
        description: data.description || null,
        health_score: 0,
      })

    if (error) throw new Error(error.message)
  }

  redirect('/onboarding/channels')
}

export interface ChannelData {
  linkedin_url?: string
  facebook_url?: string
  instagram_handle?: string
  google_business_url?: string
}

export async function saveChannels(data: ChannelData) {
  const { supabase, businessId } = await getContext()
  if (!businessId) redirect('/onboarding/business')

  const channels: Array<{ type: string; value: string }> = []
  if (data.linkedin_url) channels.push({ type: 'linkedin', value: data.linkedin_url })
  if (data.facebook_url) channels.push({ type: 'facebook', value: data.facebook_url })
  if (data.instagram_handle) channels.push({ type: 'instagram', value: data.instagram_handle })
  if (data.google_business_url) channels.push({ type: 'google_mybusiness', value: data.google_business_url })

  for (const ch of channels) {
    await supabase
      .from('integrations')
      .upsert(
        {
          business_id: businessId,
          type: ch.type,
          status: 'disconnected',
          meta_json: { profile_url: ch.value },
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'business_id,type' }
      )
  }

  redirect('/onboarding/team')
}

export async function createInitialData() {
  const { supabase, user, businessId } = await getContext()
  if (!businessId) redirect('/onboarding/business')

  const today = new Date().toISOString().split('T')[0]

  // Only create signals if none exist yet
  const { data: existingSignals } = await supabase
    .from('agent_signals')
    .select('id')
    .eq('business_id', businessId)
    .limit(1)

  if (!existingSignals || existingSignals.length === 0) {
    await supabase.from('agent_signals').insert([
      {
        business_id: businessId,
        type: 'opportunity',
        title: 'Run Your First Business Audit',
        body: 'Get a comprehensive health score by running a full audit on your website and social presence.',
        action_label: 'Run Audit',
        action_type: 'open_url',
        action_data_json: { url: '/audit' },
      },
      {
        business_id: businessId,
        type: 'insight',
        title: 'Your AI Agent is Ready',
        body: "I've set up your workspace and I'm monitoring your business 24/7. Connect channels to unlock full analysis.",
        action_label: 'Connect Channels',
        action_type: 'open_url',
        action_data_json: { url: '/settings/integrations' },
      },
      {
        business_id: businessId,
        type: 'opportunity',
        title: 'Complete Your Business Profile',
        body: 'Add your logo, description, and contact details to improve your health score.',
        action_label: 'Update Profile',
        action_type: 'open_url',
        action_data_json: { url: '/settings' },
      },
    ])
  }

  // Upsert today's health score
  await supabase.from('business_metrics').upsert(
    {
      business_id: businessId,
      date: today,
      health_score: 35,
      metrics_json: { profile_complete: 40, channels_connected: 0, content_active: 0, leads_active: 0 },
    },
    { onConflict: 'business_id,date' }
  )

  // Upsert today's tasks
  const tasks = [
    { id: 'init-1', title: 'Connect your first social channel', type: 'integration', priority: 1, completed: false, verify_via: 'integration' },
    { id: 'init-2', title: 'Run your first website audit', type: 'audit', priority: 2, completed: false, verify_via: 'audit' },
    { id: 'init-3', title: 'Invite a team member', type: 'team', priority: 3, completed: false, verify_via: 'team' },
  ]

  await supabase.from('daily_tasks').upsert(
    {
      business_id: businessId,
      date: today,
      tasks_json: tasks,
      total_count: tasks.length,
      completed_count: 0,
    },
    { onConflict: 'business_id,date' }
  )

  // Log the onboarding completion
  void user

  redirect('/onboarding/results')
}

export async function markOnboardingComplete() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email, reengagement_sent_at')
    .eq('id', user.id)
    .single()

  await supabase
    .from('profiles')
    .update({ onboarding_completed: true, last_seen_at: new Date().toISOString() })
    .eq('id', user.id)

  // Send welcome email (fire and forget)
  if (profile?.email) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('name')
      .eq('workspace_id', (await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()).data?.current_workspace_id ?? '')
      .maybeSingle()

    const { buildReengagementEmail } = await import('@/lib/emails/reengagement')
    const { subject, html, text } = buildReengagementEmail({
      name: profile.name ?? '',
      email: profile.email,
      businessName: biz?.name ?? 'My Business',
      pendingSignals: 0,
      setupPct: 14, // profile step done = 1/7
      newLeads: 0,
      stage: 'welcome',
    })

    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'agent@coovex.com'
    if (resendKey) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `CooVex <${fromEmail}>`, to: [profile.email], subject, html, text }),
      }).then(async () => {
        const sent = (profile.reengagement_sent_at as Record<string, string>) ?? {}
        await supabase.from('profiles')
          .update({ reengagement_sent_at: { ...sent, welcome: new Date().toISOString() } })
          .eq('id', user.id)
      }).catch(() => {})
    }
  }

  redirect('/dashboard')
}
