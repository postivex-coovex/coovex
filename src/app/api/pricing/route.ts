import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Cache for 60 seconds — pricing rarely changes
let _cache: { plans: unknown[]; costs: unknown[] } | null = null
let _cacheExpiry = 0

export async function GET() {
  if (_cache && Date.now() < _cacheExpiry) {
    return NextResponse.json(_cache, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  }

  const service = createServiceClient()
  const [{ data: plans }, { data: costs }] = await Promise.all([
    service.from('pricing_plans').select('*').eq('active', true).order('sort_order'),
    service.from('credit_cost_settings').select('*').order('tier').order('cost'),
  ])

  _cache = { plans: plans ?? [], costs: costs ?? [] }
  _cacheExpiry = Date.now() + 60_000

  return NextResponse.json(_cache, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}
