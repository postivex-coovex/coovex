import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()
  const { token, status, note } = await req.json()

  if (!token || !status) {
    return NextResponse.json({ error: 'Missing token or status' }, { status: 400 })
  }

  const allowed = ['accepted', 'declined']
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data: proposal, error: findErr } = await supabase
    .from('proposals')
    .select('id, status')
    .eq('share_token', token)
    .maybeSingle()

  if (findErr || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Only allow response on sent/viewed proposals
  if (!['sent', 'viewed'].includes(proposal.status)) {
    return NextResponse.json({ error: 'Proposal is not in a state that allows responses' }, { status: 409 })
  }

  // Try full update with optional columns first
  let updateErr = null
  const { error: err1 } = await supabase
    .from('proposals')
    .update({ status, responded_at: new Date().toISOString(), ...(note ? { client_note: note } : {}) })
    .eq('id', proposal.id)
  updateErr = err1

  // Fallback: if responded_at/client_note columns don't exist yet, just update status
  if (updateErr) {
    const { error: err2 } = await supabase
      .from('proposals')
      .update({ status })
      .eq('id', proposal.id)
    updateErr = err2
  }

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status })
}
