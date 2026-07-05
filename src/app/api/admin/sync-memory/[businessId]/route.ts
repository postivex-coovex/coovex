import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { syncBusinessMemory } from '@/lib/agent/sync-memory'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  // Verify admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { businessId } = await params

  // Get workspace_id for this business
  const serviceClient = await createServiceClient()
  const { data: business } = await serviceClient
    .from('businesses').select('workspace_id').eq('id', businessId).single()

  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  try {
    const context = await syncBusinessMemory(businessId, business.workspace_id, 0)
    return NextResponse.json({ ok: true, synced_at: context?.synced_at ?? new Date().toISOString() })
  } catch (err) {
    console.error('[admin/sync-memory] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
