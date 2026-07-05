import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { syncBusinessMemory } from '@/lib/agent/sync-memory'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const serviceClient = await createServiceClient()
  const { data: businesses } = await serviceClient
    .from('businesses')
    .select('id, workspace_id, name')
    .limit(100)

  if (!businesses || businesses.length === 0) {
    return NextResponse.json({ ok: true, synced: 0 })
  }

  let synced = 0
  const results: Array<{ name: string; ok: boolean }> = []

  await Promise.allSettled(
    businesses.map(async (biz) => {
      try {
        await syncBusinessMemory(biz.id, biz.workspace_id)
        synced++
        results.push({ name: biz.name, ok: true })
      } catch {
        results.push({ name: biz.name, ok: false })
      }
    })
  )

  return NextResponse.json({ ok: true, synced, total: businesses.length, results })
}
