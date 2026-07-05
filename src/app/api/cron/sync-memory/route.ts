import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { syncBusinessMemory } from '@/lib/agent/sync-memory'

// Called by VPS cron every 6 hours:
// 0 */6 * * * curl -s -X POST https://app.coovex.com/api/cron/sync-memory \
//   -H "Authorization: Bearer $CRON_SECRET" > /dev/null

export async function POST(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, workspace_id, name')
    .limit(200)

  if (!businesses || businesses.length === 0) {
    return NextResponse.json({ ok: true, synced: 0 })
  }

  let synced = 0
  const errors: string[] = []

  await Promise.allSettled(
    businesses.map(async (biz) => {
      try {
        await syncBusinessMemory(biz.id, biz.workspace_id)
        synced++
      } catch (e) {
        errors.push(`${biz.name}: ${String(e)}`)
      }
    })
  )

  console.log(`[cron/sync-memory] ${synced}/${businesses.length} synced`)
  return NextResponse.json({ ok: true, synced, total: businesses.length, errors })
}
