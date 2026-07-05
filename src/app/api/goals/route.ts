import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type GoalPeriod = 'monthly' | 'quarterly' | 'yearly'
type GoalCategory = 'leads' | 'revenue' | 'reviews' | 'content' | 'health' | 'custom'

interface GoalStored {
  id: string
  title: string
  category: GoalCategory
  period: GoalPeriod
  target: number
  unit: string
  due?: string
  custom_current?: number
}

function periodStart(period: GoalPeriod): string {
  const now = new Date()
  if (period === 'monthly') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  if (period === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3)
    return new Date(now.getFullYear(), q * 3, 1).toISOString()
  }
  return new Date(now.getFullYear(), 0, 1).toISOString()
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, health_score, integrations').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ goals: [] })

  const integrations = (business.integrations as Record<string, unknown>) ?? {}
  const storedGoals: GoalStored[] = (integrations.__goals as GoalStored[]) ?? []

  if (storedGoals.length === 0) return NextResponse.json({ goals: [] })

  const periods = [...new Set(storedGoals.map(g => g.period))] as GoalPeriod[]

  const leadsPerPeriod: Record<string, number> = {}
  const revenuePerPeriod: Record<string, number> = {}
  const reviewsPerPeriod: Record<string, number> = {}
  const postsPerPeriod: Record<string, number> = {}

  await Promise.all(periods.map(async period => {
    const since = periodStart(period)
    const [leadsR, dealsR, reviewsR, postsR] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', since),
      supabase.from('deals').select('value').eq('business_id', business.id).eq('status', 'won').gte('created_at', since),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', since),
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', since),
    ])
    leadsPerPeriod[period]   = leadsR.count ?? 0
    revenuePerPeriod[period] = (dealsR.data ?? []).reduce((s, d) => s + Number(d.value), 0)
    reviewsPerPeriod[period] = reviewsR.count ?? 0
    postsPerPeriod[period]   = postsR.count ?? 0
  }))

  const healthScore = business.health_score ?? 0

  const goals = storedGoals.map(g => {
    let current = 0
    let auto_tracked = true
    if (g.category === 'leads')        current = leadsPerPeriod[g.period] ?? 0
    else if (g.category === 'revenue') current = revenuePerPeriod[g.period] ?? 0
    else if (g.category === 'reviews') current = reviewsPerPeriod[g.period] ?? 0
    else if (g.category === 'content') current = postsPerPeriod[g.period] ?? 0
    else if (g.category === 'health')  current = healthScore
    else { current = g.custom_current ?? 0; auto_tracked = false }
    return { ...g, current, auto_tracked }
  })

  return NextResponse.json({ goals })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { goals?: GoalStored[] }
  const { goals } = body
  if (!Array.isArray(goals)) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, integrations').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const integrations = (business.integrations as Record<string, unknown>) ?? {}

  const toStore: GoalStored[] = goals.map(({ id, title, category, period, target, unit, due, custom_current }) => ({
    id, title, category, period, target, unit, due, custom_current,
  }))

  await supabase.from('businesses').update({
    integrations: { ...integrations, __goals: toStore },
  }).eq('id', business.id)

  return NextResponse.json({ ok: true })
}
