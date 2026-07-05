import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, '_').replace(/\s+/g, '_'))

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  }).filter(row => Object.values(row).some(v => v))
}

function mapRow(row: Record<string, string>): {
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  notes: string | null
} {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      if (row[k]?.trim()) return row[k].trim()
    }
    return null
  }

  return {
    name: get('name', 'full_name', 'contact_name', 'first_name'),
    email: get('email', 'email_address', 'e_mail'),
    phone: get('phone', 'phone_number', 'mobile', 'tel'),
    company: get('company', 'company_name', 'organization', 'account'),
    job_title: get('job_title', 'title', 'position', 'role', 'designation'),
    notes: get('notes', 'note', 'description', 'message'),
  }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  if (!file.name.endsWith('.csv')) return NextResponse.json({ error: 'File must be a .csv' }, { status: 400 })

  const text = await file.text()
  const rows = parseCSV(text)
  if (rows.length === 0) return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase
    .from('businesses').select('id')
    .eq('workspace_id', profile?.current_workspace_id).maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  // Get existing emails to deduplicate
  const { data: existing } = await supabase
    .from('leads').select('email').eq('business_id', business.id)
  const existingEmails = new Set((existing || []).map(l => (l.email || '').toLowerCase()))

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of rows) {
    const mapped = mapRow(row)
    if (!mapped.name) { skipped++; continue }

    // Deduplicate by email
    if (mapped.email && existingEmails.has(mapped.email.toLowerCase())) {
      skipped++
      continue
    }

    const { error } = await supabase.from('leads').insert({
      business_id: business.id,
      name: mapped.name,
      email: mapped.email?.toLowerCase() || null,
      phone: mapped.phone || null,
      company: mapped.company || null,
      job_title: mapped.job_title || null,
      notes: mapped.notes || null,
      source: 'manual',
      stage: 'new',
      lead_score: 30,
    })

    if (error) { errors.push(error.message); skipped++ }
    else {
      imported++
      if (mapped.email) existingEmails.add(mapped.email.toLowerCase())
    }
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped,
    total: rows.length,
    errors: errors.slice(0, 5),
  })
}
