import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GRAPH = 'https://graph.facebook.com/v19.0'
const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ?? 'coovex-fb-verify'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── GET: Facebook webhook verification challenge ─────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// ── POST: Incoming lead ad notification ──────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (body.object !== 'page') return NextResponse.json({ ok: true })

    const supabase = db()

    for (const entry of body.entry ?? []) {
      const pageId = String(entry.id)

      for (const change of entry.changes ?? []) {
        if (change.field !== 'leadgen') continue
        const leadgenId = change.value?.leadgen_id as string
        if (!leadgenId) continue

        // Find which business owns this Facebook page
        const { data: businesses } = await supabase.from('businesses').select('id, social_connections')

        let pageToken: string | null = null
        let businessId: string | null = null

        for (const biz of businesses ?? []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sc = (biz as any).social_connections as Record<string, any> ?? {}
          const fbPages: { id: string; access_token: string }[] = sc.facebook?.pages ?? []
          const match = fbPages.find(p => p.id === pageId)
          if (match) {
            pageToken  = match.access_token
            businessId = biz.id as string
            break
          }
        }

        if (!pageToken || !businessId) continue

        // Fetch the actual lead data from Facebook
        const leadRes = await fetch(
          `${GRAPH}/${leadgenId}?fields=id,created_time,field_data,form_id&access_token=${pageToken}`
        )
        if (!leadRes.ok) continue
        const leadData = await leadRes.json()

        const fields: { name: string; values: string[] }[] = leadData.field_data ?? []
        const get = (...keys: string[]) => {
          for (const key of keys) {
            const f = fields.find(f => f.name.toLowerCase().replace(/[^a-z]/g, '').includes(key))
            if (f?.values?.[0]) return f.values[0]
          }
          return ''
        }

        const firstName = get('firstname', 'first')
        const lastName  = get('lastname', 'last')
        const fullName  = get('fullname', 'name') || `${firstName} ${lastName}`.trim()
        const email     = get('email')
        const phone     = get('phone', 'mobile', 'tel')
        const company   = get('company', 'organization', 'business')

        if (!fullName && !email) continue

        // Deduplicate by email
        if (email) {
          const { data: dup } = await supabase
            .from('leads').select('id').eq('business_id', businessId).eq('email', email).maybeSingle()
          if (dup) continue
        }

        await supabase.from('leads').insert({
          business_id: businessId,
          name:    fullName || email,
          email:   email || null,
          phone:   phone || null,
          company: company || null,
          source:  'facebook_lead_ad',
          stage:   'new',
          score:   65,
          notes:   `Via Facebook Lead Ad · Form: ${leadData.form_id ?? '—'} · ${new Date(leadData.created_time ?? Date.now()).toLocaleDateString()}`,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('FB lead webhook error:', err)
    return NextResponse.json({ ok: true }) // always 200 to Facebook
  }
}
