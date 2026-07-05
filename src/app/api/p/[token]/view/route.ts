import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, status, view_count')
    .eq('share_token', token)
    .maybeSingle()

  if (!proposal) return NextResponse.json({ ok: false }, { status: 404 })

  await supabase
    .from('proposals')
    .update({
      view_count:     (proposal.view_count ?? 0) + 1,
      last_viewed_at: new Date().toISOString(),
      status:         proposal.status === 'sent' ? 'viewed' : proposal.status,
    })
    .eq('id', proposal.id)

  return NextResponse.json({ ok: true })
}
