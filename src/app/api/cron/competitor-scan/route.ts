import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all competitors not scanned in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, business_id')
    .or(`last_scanned_at.is.null,last_scanned_at.lt.${since}`)
    .neq('crawl_status', 'scanning')
    .limit(20)

  if (!competitors?.length) {
    return NextResponse.json({ message: 'Nothing to scan', scanned: 0 })
  }

  let scanned = 0
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  for (const comp of competitors) {
    try {
      // Use the business's session context — call internal scan endpoint
      // For cron, we call the scan endpoint directly with service role
      const res = await fetch(`${base}/api/cron/competitor-scan-single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({ competitor_id: comp.id, business_id: comp.business_id }),
      })
      if (res.ok) scanned++
    } catch (err) {
      console.error(`Failed to scan competitor ${comp.id}:`, err)
    }
  }

  return NextResponse.json({ scanned, total: competitors.length })
}
