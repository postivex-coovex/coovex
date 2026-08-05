import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function normalizeUrl(raw: string): string {
  let u = raw.trim()
  if (!u) return ''
  // Remove surrounding quotes
  u = u.replace(/^["']|["']$/g, '').trim()
  if (!u) return ''
  // Prepend scheme if missing
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`
  }
  // Validate by parsing
  try {
    const parsed = new URL(u)
    // Remove trailing slash for consistency
    return parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname)
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const sites: Array<{ url: string; name?: string; alert_emails?: string }> = body.sites ?? []

  if (!Array.isArray(sites) || sites.length === 0) {
    return NextResponse.json({ error: 'No sites provided' }, { status: 400 })
  }

  if (sites.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 URLs per import' }, { status: 400 })
  }

  const results: Array<{ url: string; success: boolean; error?: string }> = []
  const toInsert: Record<string, unknown>[] = []

  for (const site of sites) {
    const normalized = normalizeUrl(site.url ?? '')
    if (!normalized) {
      results.push({ url: site.url ?? '', success: false, error: 'Invalid URL' })
      continue
    }

    let hostname = normalized
    try { hostname = new URL(normalized).hostname } catch { /* keep full url */ }

    const emailArr: string[] = site.alert_emails
      ? site.alert_emails.split(',').map((e: string) => e.trim()).filter(Boolean)
      : []

    toInsert.push({
      user_id: user.id,
      url: normalized,
      name: site.name?.trim() || hostname,
      alert_emails: emailArr,
      alert_on_down: true,
      alert_on_ssl_expiry: true,
      alert_on_domain_expiry: true,
      alert_on_slow_load: true,
      slow_load_threshold_ms: 3000,
      next_check_at: new Date().toISOString(),
    })
  }

  if (toInsert.length === 0) {
    return NextResponse.json({
      results,
      inserted: 0,
      failed: results.length,
    })
  }

  // Insert in batches of 100 to stay within Supabase limits
  const BATCH = 100
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { data: inserted, error } = await supabase
      .from('monitored_websites')
      .insert(batch)
      .select('url')

    if (error) {
      // On batch failure try one by one
      for (const row of batch) {
        const { error: rowErr } = await supabase
          .from('monitored_websites')
          .insert(row)
          .select('url')
          .single()

        results.push({
          url: row.url as string,
          success: !rowErr,
          error: rowErr ? (rowErr.code === '23505' ? 'Already monitored' : rowErr.message) : undefined,
        })
      }
    } else {
      const insertedUrls = new Set((inserted ?? []).map((r: { url: string }) => r.url))
      for (const row of batch) {
        const wasInserted = insertedUrls.has(row.url as string)
        results.push({
          url: row.url as string,
          success: wasInserted,
          error: wasInserted ? undefined : 'Already monitored',
        })
      }
    }
  }

  return NextResponse.json({
    results,
    inserted: results.filter(r => r.success).length,
    failed:   results.filter(r => !r.success).length,
  })
}
