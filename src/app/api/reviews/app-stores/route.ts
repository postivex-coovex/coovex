import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getBusiness(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', userId).single()
  if (!profile?.current_workspace_id) return null
  const { data: business } = await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
  return business
}

// GET — fetch real reviews from DB
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const business = await getBusiness(supabase, user.id)
  if (!business) return NextResponse.json({ reviews: [], stats: { app_store: { rating: 0, count: 0 }, google_play: { rating: 0, count: 0 } }, empty: true })

  const { data: rows } = await supabase
    .from('reviews')
    .select('id, platform, rating, reviewer_name, title, body, status, response, posted_at, responded_at')
    .eq('business_id', business.id)
    .in('platform', ['app_store', 'google_play'])
    .order('posted_at', { ascending: false })

  const reviews = (rows ?? []).map(r => ({
    id: r.id,
    store: r.platform as 'app_store' | 'google_play',
    rating: r.rating,
    author: r.reviewer_name,
    title: r.title ?? '',
    body: r.body ?? '',
    date: r.posted_at ?? new Date().toISOString(),
    replied: r.status === 'responded',
    response: r.response ?? '',
  }))

  function storeStats(store: string) {
    const storeRevs = reviews.filter(r => r.store === store)
    if (!storeRevs.length) return { rating: 0, count: 0 }
    const avg = storeRevs.reduce((s, r) => s + r.rating, 0) / storeRevs.length
    return { rating: parseFloat(avg.toFixed(1)), count: storeRevs.length }
  }

  return NextResponse.json({
    reviews,
    stats: {
      app_store:   storeStats('app_store'),
      google_play: storeStats('google_play'),
    },
    empty: reviews.length === 0,
  })
}

// POST — manually add a review
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const business = await getBusiness(supabase, user.id)
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { store, rating, author, title, body, date } = await req.json()
  if (!store || !rating || !author) return NextResponse.json({ error: 'store, rating, author required' }, { status: 400 })

  const { data: review, error } = await supabase.from('reviews').insert({
    business_id: business.id,
    platform:      store,
    reviewer_name: author.trim(),
    title:         title?.trim() || null,
    rating:        Number(rating),
    body:          body?.trim() || null,
    status:        'new',
    posted_at:     date || new Date().toISOString(),
  }).select('id, platform, rating, reviewer_name, title, body, status, posted_at').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ review })
}
