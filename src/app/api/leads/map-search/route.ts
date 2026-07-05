import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

// ─── OSM types ───────────────────────────────────────────────────────────────

interface OverpassElement {
  type:   'node' | 'way' | 'relation'
  id:     number
  lat?:   number
  lon?:   number
  center?: { lat: number; lon: number }
  tags:   Record<string, string>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickTag(tags: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) if (tags[k]) return tags[k]
  return ''
}

function extractEmails(html: string): string[] {
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const bad = ['noreply', 'no-reply', 'example.', 'sentry.', 'w3.org', 'schema.org', 'cloudflare', 'wixpress', 'wordpress', 'jquery', '.png', '.jpg']
  return [...new Set(html.match(re) ?? [])].filter(e => !bad.some(b => e.toLowerCase().includes(b))).slice(0, 3)
}

// For businesses without OSM website, search SearXNG to find their website
async function findWebsiteViaSearX(name: string, locationHint: string): Promise<string> {
  const searxUrl = process.env.SEARCH_SERVICE_URL
  if (!searxUrl) return ''
  try {
    const query  = `"${name}" ${locationHint}`
    const params = new URLSearchParams({ q: query, format: 'json' })
    const res    = await fetch(`${searxUrl}/search?${params}`, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return ''
    const data   = await res.json()
    const SKIP   = ['facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'youtube.com', 'wikipedia.org', 'scribd.com', 'google.com', 'maps.google']
    return (data.results ?? []).find((r: { url: string }) => {
      try { const h = new URL(r.url).hostname; return !SKIP.some(s => h.includes(s)) } catch { return false }
    })?.url ?? ''
  } catch { return '' }
}

async function scrapeEmail(url: string): Promise<string[]> {
  try {
    const base = new URL(url).origin
    for (const page of [url, `${base}/contact`, `${base}/contact-us`]) {
      try {
        const res = await fetch(page, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CooVexBot/1.0; +https://coovex.com)' },
          signal:  AbortSignal.timeout(5000),
        })
        if (!res.ok) continue
        const emails = extractEmails(await res.text())
        if (emails.length) return emails
      } catch { continue }
    }
  } catch {}
  return []
}

// Geocode a location string → [south, west, north, east] bounding box
async function geocodeBBox(location: string): Promise<[number, number, number, number] | null> {
  try {
    const params = new URLSearchParams({ q: location, format: 'json', limit: '1', addressdetails: '0' })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent':      'CooVex/1.0 (lead-generation; contact@coovex.com)',
        'Accept-Language': 'en',
        'Referer':         'https://coovex.com',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[MapSearch] Nominatim HTTP', res.status)
      return null
    }
    const results = await res.json()
    const hit = results[0]
    if (!hit?.boundingbox) {
      console.error('[MapSearch] No geocode result for:', location)
      return null
    }
    console.log('[MapSearch] Geocoded:', location, '→', hit.display_name, hit.boundingbox)
    // Nominatim returns [minlat, maxlat, minlon, maxlon]
    const [s, n, w, e] = hit.boundingbox.map(Number)
    return [s, w, n, e]
  } catch (err) {
    console.error('[MapSearch] Geocode error:', err)
    return null
  }
}

const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',   // works from most servers
  'https://overpass.openstreetmap.ru/api/interpreter',          // Russia mirror
  'https://overpass-api.de/api/interpreter',                    // primary (may be blocked by some IPs)
]

// Query OpenStreetMap Overpass API for business nodes/ways inside a bounding box
async function queryOverpass(
  bbox: [number, number, number, number],
  osmTags: string[],
  limit = 60,
): Promise<OverpassElement[]> {
  const [s, w, n, e] = bbox
  const bboxStr = `${s},${w},${n},${e}`

  // nodes only (faster than nodes+ways for initial discovery)
  const filters = osmTags.map(tag => {
    const eq = tag.indexOf('=')
    const k  = tag.slice(0, eq)
    const v  = tag.slice(eq + 1)
    return `  nwr["${k}"="${v}"](${bboxStr});`
  }).join('\n')

  // 60s internal timeout, allow larger memory for big countries
  const query = `[out:json][timeout:60][maxsize:536870912];\n(\n${filters}\n);\nout center ${limit};`

  console.log('[MapSearch] Overpass query bbox:', bboxStr, '| tags:', osmTags)

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `data=${encodeURIComponent(query)}`,
        signal:  AbortSignal.timeout(35000),
      })
      if (!res.ok) {
        console.error('[MapSearch] Overpass HTTP', res.status, 'from', endpoint)
        continue
      }
      const data = await res.json()
      if (data.elements === undefined) {
        console.error('[MapSearch] No elements field in response from', endpoint)
        continue
      }
      const nodes = (data.elements as OverpassElement[]).filter(el => el.tags?.name)
      console.log('[MapSearch] Got', nodes.length, 'named nodes from', endpoint)
      return nodes
    } catch (e) {
      console.error('[MapSearch] Overpass error from', endpoint, ':', e)
      continue
    }
  }
  return []
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { product_id, seen_domains = [] } = await req.json() as { product_id: string; seen_domains?: string[] }
  if (!product_id) return NextResponse.json({ error: 'product_id required' }, { status: 400 })

  const { data: product } = await supabase
    .from('products')
    .select('id, name, category, target_audience, type, tagline, description')
    .eq('id', product_id)
    .single()

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  // ── Step 1: AI extracts location + OSM tags from product info ────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const aiRes = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 350,
    messages: [{
      role: 'user',
      content: `Analyze this product and extract location + OpenStreetMap tags for finding local buyers.

Product: ${product.name}
Type: ${product.type}
Category: ${product.category ?? 'N/A'}
Target audience: ${product.target_audience ?? 'N/A'}
Description: ${product.description ?? 'N/A'}

Extract:
1. location — specific city or country from target audience (e.g. "Dhaka, Bangladesh" or "Bangladesh")
2. osm_tags — 2-3 OpenStreetMap tags for the TARGET CUSTOMER businesses
3. buyer_role — job title of the person who approves the purchase

OSM tag reference:
- Schools/madrasas → amenity=school
- Colleges → amenity=college
- Universities → amenity=university
- Hospitals → amenity=hospital
- Clinics → amenity=clinic
- Restaurants → amenity=restaurant
- Hotels/guesthouses → tourism=hotel
- Offices/companies → office=company
- Shops/supermarkets → shop=supermarket
- Pharmacies → amenity=pharmacy
- Mosques → amenity=place_of_worship

Return ONLY valid JSON:
{
  "location": "Dhaka, Bangladesh",
  "osm_tags": ["amenity=school", "amenity=college"],
  "buyer_role": "School Principal"
}`,
    }],
  })

  let location  = product.target_audience ?? 'Bangladesh'
  let osmTags   = ['amenity=school']
  let buyerRole = ''

  try {
    const text    = (aiRes.content[0] as { type: string; text: string }).text.trim()
    const jsonStr = text.startsWith('{') ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    const parsed  = JSON.parse(jsonStr)
    location  = parsed.location   || location
    osmTags   = parsed.osm_tags   || osmTags
    buyerRole = parsed.buyer_role || ''
  } catch {}

  console.log('[MapSearch] Location:', location, '| Tags:', osmTags, '| Buyer:', buyerRole)

  // ── Step 2: Geocode location → bounding box ────────────────────────────────
  const bbox = await geocodeBBox(location)
  if (!bbox) {
    return NextResponse.json({
      leads: [], buyer_role: buyerRole, location, osm_tags: osmTags, total_with_contact: 0,
      error: `Could not find location: "${location}" on map`,
    })
  }
  console.log('[MapSearch] BBox:', bbox)

  // ── Step 3: Query Overpass → get business nodes ────────────────────────────
  const nodes = await queryOverpass(bbox, osmTags)
  console.log('[MapSearch] Overpass returned', nodes.length, 'nodes')

  if (nodes.length === 0) {
    return NextResponse.json({
      leads: [], buyer_role: buyerRole, location, osm_tags: osmTags, total_with_contact: 0,
    })
  }

  // Sort: nodes with website first; limit to 50
  const sorted = [...nodes].sort((a, b) => {
    const aW = !!(pickTag(a.tags, 'website', 'contact:website', 'url'))
    const bW = !!(pickTag(b.tags, 'website', 'contact:website', 'url'))
    return aW === bW ? 0 : aW ? -1 : 1
  }).slice(0, 50)

  // ── Step 4a: For nodes without OSM website, find via SearXNG (parallel) ───
  const noSite = sorted.filter(el => !pickTag(el.tags, 'website', 'contact:website', 'url'))
  console.log('[MapSearch] Nodes without website:', noSite.length, '— searching SearXNG for top 20')

  const foundWebsites = await Promise.all(
    noSite.slice(0, 20).map(async el => {
      const name = pickTag(el.tags, 'name:en', 'name')
      const city = pickTag(el.tags, 'addr:city', 'addr:district', 'is_in:city') || location
      const url  = await findWebsiteViaSearX(name, city)
      return { id: el.id, url }
    })
  )
  const websiteMap = new Map(foundWebsites.map(f => [f.id, f.url]))

  // ── Step 4b: Build leads — scrape websites for email ──────────────────────
  const leads = await Promise.all(
    sorted.map(async el => {
      const name     = pickTag(el.tags, 'name:en', 'name')
      const phone    = pickTag(el.tags, 'phone', 'contact:phone', 'mobile', 'contact:mobile')
      const osmSite  = pickTag(el.tags, 'website', 'contact:website', 'url')
      const website  = osmSite || websiteMap.get(el.id) || ''
      const osmEmail = pickTag(el.tags, 'email', 'contact:email')
      const city     = pickTag(el.tags, 'addr:city', 'addr:district', 'is_in:city')
      const street   = pickTag(el.tags, 'addr:street', 'addr:full')
      const lat      = el.lat ?? el.center?.lat
      const lon      = el.lon ?? el.center?.lon

      let emails = osmEmail ? [osmEmail] : []
      let domain = ''

      if (website && emails.length === 0) {
        try {
          domain = new URL(website).hostname.replace('www.', '')
          emails = await scrapeEmail(website)
        } catch {}
      }

      const phones  = phone ? [phone.replace(/[\s\-]/g, '')] : []
      const mapLink = (lat && lon)
        ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`
        : ''

      const snippetParts = [
        el.tags.amenity ?? el.tags.shop ?? el.tags.office ?? el.tags.tourism ?? '',
        street, city,
      ].filter(Boolean)

      return {
        title:   name,
        website: website || mapLink,
        domain:  domain  || `map_${el.id}`,
        snippet: snippetParts.join(' · '),
        emails,
        phones,
        mapLink,
      }
    })
  )

  // Exclude already-seen domains (for Load More pagination)
  const freshLeads = seen_domains.length > 0
    ? leads.filter(l => !seen_domains.includes(l.domain))
    : leads

  const withContact    = freshLeads.filter(l => l.emails.length > 0 || l.phones.length > 0)
  const withoutContact = freshLeads.filter(l => l.emails.length === 0 && l.phones.length === 0)

  console.log('[MapSearch] With contact:', withContact.length, '/ Without:', withoutContact.length, '/ Excluded:', leads.length - freshLeads.length)

  return NextResponse.json({
    leads:              [...withContact, ...withoutContact],
    buyer_role:         buyerRole,
    location,
    osm_tags:           osmTags,
    total_with_contact: withContact.length,
    product_name:       product.name,
  })
}
