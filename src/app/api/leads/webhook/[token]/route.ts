/**
 * Lead Funnel Webhook Receiver
 * Each business gets a unique URL: /api/leads/webhook/[token]
 * Accepts leads from: Typeform, Gravity Forms, Zapier, Make, custom forms
 *
 * Token = HMAC-SHA256(businessId, WEBHOOK_SECRET) — deterministic, no DB change needed
 */
import { NextRequest, NextResponse } from 'next/server'
import { generateWebhookToken } from '@/lib/webhook-token'

// Normalize lead data from multiple form/webhook formats
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractLead(payload: any): {
  name: string; email: string; phone: string; company: string;
  message: string; source: string
} {
  // Typeform format
  if (payload?.form_response?.answers) {
    const answers = payload.form_response.answers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const get = (type: string): string => answers.find((a: any) => a.type === type)?.text
      || answers.find((a: any) => a.type === type)?.email
      || ''
    const hidden = payload.form_response?.hidden ?? {}
    return {
      name: get('text') || hidden.name || '',
      email: answers.find((a: { type: string; email: string }) => a.type === 'email')?.email || hidden.email || '',
      phone: answers.find((a: { type: string; phone_number: string }) => a.type === 'phone_number')?.phone_number || '',
      company: hidden.company || '',
      message: answers.find((a: { type: string; text: string }) => a.type === 'long_text')?.text || '',
      source: 'typeform',
    }
  }

  // Gravity Forms / WPForms format
  if (payload?.form_id && payload?.entry_id) {
    return {
      name: payload.name || payload.full_name || `${payload.first_name ?? ''} ${payload.last_name ?? ''}`.trim() || '',
      email: payload.email || '',
      phone: payload.phone || payload.telephone || '',
      company: payload.company || payload.organization || '',
      message: payload.message || payload.comments || '',
      source: 'wordpress_form',
    }
  }

  // Generic flat object (Zapier, Make, custom)
  return {
    name: payload.name || payload.full_name || `${payload.first_name ?? ''} ${payload.last_name ?? ''}`.trim() || '',
    email: payload.email || payload.email_address || '',
    phone: payload.phone || payload.phone_number || payload.mobile || '',
    company: payload.company || payload.company_name || payload.organization || '',
    message: payload.message || payload.notes || payload.body || '',
    source: payload.source || payload._source || 'webhook',
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // We need service role to find business without auth context
  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get all businesses and find matching token
  const { data: businesses } = await serviceClient.from('businesses').select('id, name')
  const business = businesses?.find(b => generateWebhookToken(b.id) === token)

  if (!business) {
    return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      payload = await request.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text()
      payload = Object.fromEntries(new URLSearchParams(text))
    } else {
      payload = await request.json().catch(() => ({}))
    }
  } catch {
    payload = {}
  }

  const lead = extractLead(payload)

  // Require at least name or email
  if (!lead.name && !lead.email) {
    return NextResponse.json({ error: 'name or email required' }, { status: 400 })
  }

  const { error } = await serviceClient.from('leads').insert({
    business_id: business.id,
    name: lead.name || lead.email.split('@')[0],
    email: lead.email || null,
    phone: lead.phone || null,
    company: lead.company || null,
    stage: 'new',
    source: lead.source,
    notes: lead.message ? `Via webhook: ${lead.message}` : `Received via ${lead.source} webhook`,
    created_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[webhook] insert error:', error)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }

  // Return 200 with simple JSON (Typeform/Zapier expect 200)
  return NextResponse.json({ received: true, business: business.name })
}

// HEAD request — used by some services to verify the endpoint
export async function HEAD() {
  return new Response(null, { status: 200 })
}
