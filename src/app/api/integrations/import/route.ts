/**
 * CSV import for deals.
 * Expected columns (case-insensitive, flexible naming):
 * name, company, email, phone, value, currency, close_date, status, stage, probability
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const STAGE_MAP: Record<string, string> = {
  new: 'new', lead: 'new', prospect: 'new',
  contacted: 'contacted',
  qualified: 'qualified',
  proposal: 'proposal', proposal_sent: 'proposal',
  negotiation: 'negotiation',
  won: 'won', closed: 'won', 'closed won': 'won',
  lost: 'lost', 'closed lost': 'lost',
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, '_')
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(normalizeHeader)
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  }).filter(row => Object.values(row).some(v => v))
}

// Accept multiple header name variants
function pick(row: Record<string, string>, ...keys: string[]) {
  for (const k of keys) { if (row[k]) return row[k] }
  return ''
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const contentType = req.headers.get('content-type') ?? ''
  let csvText = ''

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    csvText = await file.text()
  } else {
    const body = await req.json() as { csv?: string }
    csvText = body.csv ?? ''
  }

  if (!csvText.trim()) return NextResponse.json({ error: 'Empty CSV' }, { status: 400 })

  const rows = parseCSV(csvText)
  if (rows.length === 0) return NextResponse.json({ error: 'No data rows found' }, { status: 400 })

  let imported = 0
  let skipped  = 0
  const errors: string[] = []

  for (const row of rows) {
    const name     = pick(row, 'name', 'contact_name', 'contact', 'full_name', 'customer')
    const company  = pick(row, 'company', 'company_name', 'organization', 'account')
    const email    = pick(row, 'email', 'email_address')
    const valueStr = pick(row, 'value', 'amount', 'deal_value', 'revenue', 'price')
    const value    = parseFloat(valueStr.replace(/[^0-9.]/g, '')) || 0
    const currency = pick(row, 'currency') || 'USD'
    const closeDateRaw = pick(row, 'close_date', 'closed_date', 'closing_date', 'date', 'won_date')
    const closeDate = closeDateRaw ? new Date(closeDateRaw).toISOString().slice(0, 10) : null
    const statusRaw = pick(row, 'status', 'deal_status').toLowerCase()
    const status    = statusRaw === 'won' ? 'won' : statusRaw === 'lost' ? 'lost' : 'open'
    const stageRaw  = pick(row, 'stage', 'pipeline_stage', 'deal_stage').toLowerCase()
    const stage     = STAGE_MAP[stageRaw] ?? (status === 'won' ? 'won' : status === 'lost' ? 'lost' : 'proposal')
    const probStr   = pick(row, 'probability', 'prob', 'likelihood')
    const probability = probStr ? Math.min(100, Math.max(0, parseInt(probStr))) : (status === 'won' ? 100 : 50)
    const phone     = pick(row, 'phone', 'phone_number', 'mobile')

    if (!name && !company && !email) { skipped++; continue }

    try {
      // Find or create lead
      let leadId: string | null = null

      if (email) {
        const { data: byEmail } = await supabase.from('leads')
          .select('id').eq('business_id', business.id).eq('email', email).maybeSingle()
        leadId = byEmail?.id ?? null
      }

      if (!leadId) {
        const { data: newLead } = await supabase.from('leads').insert({
          business_id: business.id,
          name:        name || company || email,
          company:     company || null,
          email:       email || null,
          phone:       phone || null,
          stage,
          source:      'crm_import',
          score:       50,
        }).select('id').single()
        leadId = newLead?.id ?? null
      }

      if (!leadId) { skipped++; continue }

      await supabase.from('deals').insert({
        business_id: business.id,
        lead_id:     leadId,
        value,
        currency,
        close_date:  closeDate,
        probability,
        status,
      })

      imported++
    } catch (e) {
      errors.push(`Row ${imported + skipped + 1}: ${e instanceof Error ? e.message : 'failed'}`)
      skipped++
    }
  }

  return NextResponse.json({ ok: true, imported, skipped, total: rows.length, errors: errors.slice(0, 5) })
}
