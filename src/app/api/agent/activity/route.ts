import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase.from('businesses').select('id, name')
    .eq('workspace_id', profile?.current_workspace_id ?? '').maybeSingle()
  if (!business) return NextResponse.json({ activity: [], minutesSaved: 0 })

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const oneDayAgo    = new Date(Date.now() - 86400000).toISOString()

  const [
    { count: signals7d },
    { count: postsGenerated },
    { count: leadsCapture },
    { count: audits7d },
    { count: proposalsCreated },
    { count: campaignsSent },
    { count: reviewsNew },
    { data: topSignal },
  ] = await Promise.all([
    supabase.from('agent_signals').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).gte('created_at', sevenDaysAgo),
    supabase.from('posts').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).gte('created_at', sevenDaysAgo),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).gte('created_at', sevenDaysAgo),
    supabase.from('audits').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).gte('created_at', sevenDaysAgo),
    supabase.from('proposals').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).gte('created_at', sevenDaysAgo),
    supabase.from('email_campaigns').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).eq('status', 'sent').gte('sent_at', sevenDaysAgo),
    supabase.from('reviews').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).eq('status', 'new').gte('created_at', sevenDaysAgo),
    supabase.from('agent_signals').select('title, type, created_at').eq('business_id', business.id)
      .gte('created_at', oneDayAgo).order('created_at', { ascending: false }).limit(1),
  ])

  type Activity = {
    id: string
    icon: string
    label: string
    detail: string
    time: string
    category: 'insight' | 'content' | 'lead' | 'audit' | 'campaign'
    minutesSaved: number
  }

  const now = new Date()
  const todayStr = now.toISOString()

  const items: Activity[] = []

  // Morning brief (always runs daily)
  items.push({
    id: 'brief',
    icon: '🌅',
    label: 'Prepared your morning brief',
    detail: 'Personalized daily summary with key metrics and recommended actions',
    time: todayStr,
    category: 'insight',
    minutesSaved: 15,
  })

  if ((signals7d ?? 0) > 0) {
    items.push({
      id: 'signals',
      icon: '🧠',
      label: `Generated ${signals7d} business insights`,
      detail: topSignal?.[0]?.title ? `Latest: "${topSignal[0].title}"` : 'Analyzed your business data to surface opportunities',
      time: topSignal?.[0]?.created_at ?? sevenDaysAgo,
      category: 'insight',
      minutesSaved: (signals7d ?? 0) * 12,
    })
  }

  if ((postsGenerated ?? 0) > 0) {
    items.push({
      id: 'posts',
      icon: '✍️',
      label: `Created ${postsGenerated} content piece${postsGenerated !== 1 ? 's' : ''}`,
      detail: 'AI-written posts tailored to your business, tone, and audience',
      time: sevenDaysAgo,
      category: 'content',
      minutesSaved: (postsGenerated ?? 0) * 20,
    })
  }

  if ((leadsCapture ?? 0) > 0) {
    items.push({
      id: 'leads',
      icon: '🎯',
      label: `Captured & scored ${leadsCapture} lead${leadsCapture !== 1 ? 's' : ''}`,
      detail: 'Auto-qualified and categorized each lead by interest and potential value',
      time: sevenDaysAgo,
      category: 'lead',
      minutesSaved: (leadsCapture ?? 0) * 8,
    })
  }

  if ((audits7d ?? 0) > 0) {
    items.push({
      id: 'audit',
      icon: '🔍',
      label: `Audited ${audits7d} website${audits7d !== 1 ? 's' : ''}`,
      detail: 'Deep website analysis: SEO, performance, content gaps, competitor positioning',
      time: sevenDaysAgo,
      category: 'audit',
      minutesSaved: (audits7d ?? 0) * 40,
    })
  }

  if ((proposalsCreated ?? 0) > 0) {
    items.push({
      id: 'proposals',
      icon: '📄',
      label: `Generated ${proposalsCreated} proposal${proposalsCreated !== 1 ? 's' : ''}`,
      detail: 'Professional client proposals with pricing, timeline, and trackable share links',
      time: sevenDaysAgo,
      category: 'content',
      minutesSaved: (proposalsCreated ?? 0) * 45,
    })
  }

  if ((campaignsSent ?? 0) > 0) {
    items.push({
      id: 'campaigns',
      icon: '📧',
      label: `Sent ${campaignsSent} email campaign${campaignsSent !== 1 ? 's' : ''}`,
      detail: 'Personalized emails delivered to segmented lead lists automatically',
      time: sevenDaysAgo,
      category: 'campaign',
      minutesSaved: (campaignsSent ?? 0) * 30,
    })
  }

  if ((reviewsNew ?? 0) > 0) {
    items.push({
      id: 'reviews',
      icon: '⭐',
      label: `Flagged ${reviewsNew} new review${reviewsNew !== 1 ? 's' : ''} for response`,
      detail: 'AI monitors incoming reviews and surfaces ones needing your attention',
      time: sevenDaysAgo,
      category: 'insight',
      minutesSaved: (reviewsNew ?? 0) * 5,
    })
  }

  const totalMinutes = items.reduce((s, i) => s + i.minutesSaved, 0)

  return NextResponse.json({ activity: items, minutesSaved: totalMinutes })
}
