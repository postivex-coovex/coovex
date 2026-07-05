import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNewLeadAlertEmail } from '@/lib/email'
import { syncBusinessMemory } from '@/lib/agent/sync-memory'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ leads: [] })

    const { data: business } = await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ leads: [] })

    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ leads: leads || [] })
  } catch (error) {
    console.error('GET /api/leads error:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { business_id, name, email, phone, company, job_title, source, stage, notes, score } = body

    if (!business_id || !name) {
      return NextResponse.json({ error: 'business_id and name are required' }, { status: 400 })
    }

    const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
    const { data: business } = await supabase
      .from('businesses').select('id').eq('id', business_id).eq('workspace_id', profile?.current_workspace_id).single()

    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    // Duplicate detection: check by email
    if (email?.trim()) {
      const { data: dup } = await supabase
        .from('leads')
        .select('id, name')
        .eq('business_id', business_id)
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()
      if (dup) {
        return NextResponse.json({ error: 'duplicate', duplicate_id: dup.id, duplicate_name: dup.name }, { status: 409 })
      }
    }

    const { data: lead, error } = await supabase.from('leads').insert({
      business_id,
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      job_title: job_title?.trim() || null,
      source: source || 'manual',
      stage: stage || 'new',
      notes: notes?.trim() || null,
      score: score ?? 50,
      assigned_to: user.id,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Fire integrations + owner alert email in background (non-blocking)
    const { data: bizFull } = await supabase
      .from('businesses').select('integrations, name, workspace_id').eq('id', business_id).single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const integrations = (bizFull as any)?.integrations as Record<string, { enabled?: boolean; [k: string]: unknown }> ?? {}

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.allSettled([
      triggerHubSpot(integrations.hubspot, lead),
      triggerMailchimp(integrations.mailchimp, lead),
      triggerZapier(integrations.zapier, lead, 'lead.created'),
      // Notify workspace owner by email
      (async () => {
        try {
          const svc = createServiceClient()
          const { data: members } = await svc.from('workspace_members')
            .select('user_id').eq('workspace_id', bizFull?.workspace_id).eq('role', 'owner').limit(1)
          if (members?.[0]) {
            const { data: ownerProfile } = await svc.from('profiles')
              .select('email, name').eq('id', members[0].user_id).single()
            if (ownerProfile?.email) {
              await sendNewLeadAlertEmail(ownerProfile.email, ownerProfile.name ?? 'there', {
                id: lead.id,
                name: lead.name,
                email: lead.email,
                company: lead.company,
                source: lead.source,
                score: lead.score,
              })
            }
          }
        } catch { /* non-fatal */ }
      })(),
    ])

    // Auto-sync AI memory after new lead (fire-and-forget)
    if (bizFull?.workspace_id) {
      syncBusinessMemory(business_id, bizFull.workspace_id, 0).catch(() => {})
    }

    return NextResponse.json({ lead }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── Integration helpers ────────────────────────────────────────────

async function triggerHubSpot(cfg: Record<string, unknown> | undefined, lead: Record<string, unknown>) {
  if (!cfg?.enabled || !cfg.api_key) return
  await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        email:     lead.email     ?? '',
        firstname: (lead.name as string)?.split(' ')[0] ?? '',
        lastname:  (lead.name as string)?.split(' ').slice(1).join(' ') ?? '',
        phone:     lead.phone     ?? '',
        company:   lead.company   ?? '',
        jobtitle:  lead.job_title ?? '',
        hs_lead_status: 'NEW',
        lead_source: `CooVex - ${lead.source ?? 'manual'}`,
      },
    }),
  }).catch(() => null)
}

async function triggerMailchimp(cfg: Record<string, unknown> | undefined, lead: Record<string, unknown>) {
  if (!cfg?.enabled || !cfg.api_key || !cfg.list_id || !lead.email) return
  const dc = (cfg.api_key as string).split('-').pop()
  const [firstName, ...lastParts] = ((lead.name as string) ?? '').split(' ')
  await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${cfg.list_id}/members`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${cfg.api_key}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: lead.email,
      status:        'subscribed',
      merge_fields: {
        FNAME: firstName ?? '',
        LNAME: lastParts.join(' ') ?? '',
        PHONE: lead.phone ?? '',
        COMPANY: lead.company ?? '',
      },
    }),
  }).catch(() => null)
}

async function triggerZapier(cfg: Record<string, unknown> | undefined, data: unknown, event: string) {
  if (!cfg?.enabled || !cfg.webhook_url) return
  await fetch(cfg.webhook_url as string, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, source: 'coovex', timestamp: new Date().toISOString(), data }),
  }).catch(() => null)
}
