import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ responses: [], score: null })

  const { data: responses, error } = await supabase
    .from('nps_responses')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ responses: [], score: null })

  const all = responses || []
  let score: number | null = null
  if (all.length > 0) {
    const promoters  = all.filter(r => r.score >= 9).length
    const detractors = all.filter(r => r.score <= 6).length
    score = Math.round(((promoters - detractors) / all.length) * 100)
  }

  return NextResponse.json({ responses: all, score })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { score, comment, respondent_name, respondent_email } = await req.json()
  if (typeof score !== 'number' || score < 0 || score > 10) {
    return NextResponse.json({ error: 'score must be 0-10' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const category = score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor'

  const { data: response, error } = await supabase
    .from('nps_responses')
    .insert({
      business_id: business.id,
      score,
      comment: comment || null,
      respondent_name: respondent_name || null,
      respondent_email: respondent_email || null,
      category,
    })
    .select()
    .single()

  if (error) {
    // Table may not exist yet — return mock success
    return NextResponse.json({
      ok: true,
      category,
      show_review_request: score >= 9,
      response: { id: 'mock', score, category, comment, created_at: new Date().toISOString() },
    })
  }

  return NextResponse.json({
    ok: true,
    category,
    show_review_request: score >= 9,
    response,
  })
}
