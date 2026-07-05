import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    // getSession reads the local cookie — no Supabase Auth API call → no rate limit risk
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ count: 0 })

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', session.user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ count: 0 })

    const { data: business } = await supabase
      .from('businesses').select('id').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    if (!business) return NextResponse.json({ count: 0 })

    const { count } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .in('status', ['draft', 'pending_approval'])

    return NextResponse.json({ count: count ?? 0 })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
