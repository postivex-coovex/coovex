import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { emails } = await req.json() as { emails: string[] }
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'No emails provided' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  if (!profile?.current_workspace_id) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
  }

  const supabaseAdmin = createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const results: { email: string; success: boolean; error?: string }[] = []

  for (const email of emails) {
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { workspace_id: profile.current_workspace_id, role: 'viewer' },
      redirectTo: `${appUrl}/api/auth/callback?workspace_id=${profile.current_workspace_id}&next=/dashboard`,
    })
    results.push({ email, success: !error, error: error?.message })
  }

  return NextResponse.json({ results })
}
