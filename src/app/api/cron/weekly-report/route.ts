import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWeeklyReportEmail } from '@/lib/email'

// Vercel Cron — runs every Monday at 7:00 AM UTC

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: 'RESEND_API_KEY not configured' })
  }

  const supabase = await createServiceClient()
  const { data: businesses } = await supabase.from('businesses').select('id, name, health_score, workspace_id').limit(500)

  if (!businesses?.length) return NextResponse.json({ ok: true, processed: 0 })

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  let processed = 0

  for (const biz of businesses) {
    try {
      const [{ data: leads }, { data: wonLeads }, { data: reviews }] = await Promise.all([
        supabase.from('leads').select('id').eq('business_id', biz.id).gte('created_at', weekAgo),
        supabase.from('leads').select('id').eq('business_id', biz.id).eq('stage', 'won').gte('updated_at', weekAgo),
        supabase.from('reviews').select('id').eq('business_id', biz.id).gte('created_at', weekAgo),
      ])

      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id, role')
        .eq('workspace_id', biz.workspace_id)
        .eq('role', 'owner')
        .limit(1)

      if (members?.[0]) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, name')
          .eq('id', members[0].user_id)
          .single()

        if (profile?.email) {
          await sendWeeklyReportEmail(profile.email, profile.name ?? 'there', {
            won: wonLeads?.length ?? 0,
            leads: leads?.length ?? 0,
            reviews: reviews?.length ?? 0,
            healthScore: biz.health_score ?? 0,
          })
          processed++
        }
      }
    } catch (err) {
      console.error(`[cron/weekly-report] error for biz ${biz.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, processed })
}
