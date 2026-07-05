import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendIntegrationInquiryEmail, sendInquiryConfirmationEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name: string
      email: string
      service_type: string
      description: string
      budget?: string
    }

    const { name, email, service_type, description, budget } = body
    if (!name || !email || !service_type || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get workspace info if logged in
    let businessName: string | null = null
    let workspaceId: string | null = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
        workspaceId = profile?.current_workspace_id ?? null
        if (workspaceId) {
          const { data: biz } = await supabase.from('businesses').select('name').eq('workspace_id', workspaceId).maybeSingle()
          businessName = biz?.name ?? null
        }
      }
    } catch {}

    // Save to DB
    const { data: inquiry, error: dbError } = await supabase.from('integration_inquiries').insert({
      name,
      email,
      service_type,
      description,
      budget: budget || null,
      business_name: businessName,
      workspace_id: workspaceId,
      status: 'new',
    }).select('id').single()

    if (dbError) {
      console.error('[integration-service] DB error:', dbError)
      // Don't fail — still send emails even if DB isn't set up yet
    }

    const inquiryId = (inquiry as { id: string } | null)?.id ?? 'N/A'

    // Send admin notification email
    const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
    if (adminEmails.length > 0) {
      await sendIntegrationInquiryEmail({
        to: adminEmails[0],
        inquiryId,
        name,
        email,
        service_type,
        description,
        budget: budget || 'Not specified',
        businessName: businessName || 'Unknown',
      }).catch(err => console.error('[integration-service] admin email error:', err))
    }

    // Send confirmation to user
    await sendInquiryConfirmationEmail({
      to: email,
      name,
      service_type,
    }).catch(err => console.error('[integration-service] user email error:', err))

    return NextResponse.json({ ok: true, id: inquiryId })
  } catch (err) {
    console.error('[integration-service] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Admin — list inquiries
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!adminEmails.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use service role to bypass RLS
  const service = createServiceClient()
  const { data, error } = await service
    .from('integration_inquiries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inquiries: data })
}

// Admin — update status or send proposal
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!adminEmails.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, status, proposal } = await req.json() as { id: string; status?: string; proposal?: string }

  const service = createServiceClient()
  await service.from('integration_inquiries').update({
    ...(status ? { status } : {}),
    ...(proposal ? { proposal_sent_at: new Date().toISOString() } : {}),
  }).eq('id', id)

  if (proposal) {
    const { data: inquiry } = await service
      .from('integration_inquiries')
      .select('email, name, service_type')
      .eq('id', id)
      .single()
    if (inquiry) {
      const { sendProposalEmail } = await import('@/lib/email')
      await sendProposalEmail({
        to: (inquiry as { email: string }).email,
        name: (inquiry as { name: string }).name,
        service_type: (inquiry as { service_type: string }).service_type,
        proposal,
      }).catch(err => console.error('[integration-service] proposal email error:', err))
    }
  }

  return NextResponse.json({ ok: true })
}
