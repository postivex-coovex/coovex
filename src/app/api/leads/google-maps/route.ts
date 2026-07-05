import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 15

interface PlaceResult {
  place_id: string
  name: string
  formatted_address: string
  rating?: number
  user_ratings_total?: number
  types?: string[]
  business_status?: string
  geometry?: { location: { lat: number; lng: number } }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GOOGLE_MAPS_API_KEY not configured', setup_required: true }, { status: 200 })

  const { business_type, location } = await req.json()
  if (!business_type || !location) {
    return NextResponse.json({ error: 'business_type and location required' }, { status: 400 })
  }

  const query = encodeURIComponent(`${business_type} in ${location}`)
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`

  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) return NextResponse.json({ error: 'Google Maps API error' }, { status: 502 })

  const data = await res.json()
  if (data.status === 'REQUEST_DENIED') {
    return NextResponse.json({ error: 'API key invalid or Places API not enabled', setup_required: true }, { status: 200 })
  }

  const results: PlaceResult[] = data.results ?? []
  const leads = results.slice(0, 15).map(p => ({
    place_id:    p.place_id,
    name:        p.name,
    address:     p.formatted_address,
    rating:      p.rating ?? null,
    reviews:     p.user_ratings_total ?? 0,
    types:       (p.types ?? []).filter(t => !['point_of_interest', 'establishment'].includes(t)).slice(0, 2),
    maps_url:    `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
    status:      p.business_status ?? 'OPERATIONAL',
  }))

  return NextResponse.json({ leads, total: results.length })
}
