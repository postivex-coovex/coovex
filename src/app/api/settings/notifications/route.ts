import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// preferences_json column doesn't exist yet in profiles — stub that returns success
// Run: ALTER TABLE profiles ADD COLUMN preferences_json jsonb DEFAULT '{}';
// to persist these server-side in the future.
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Stub: return success — preferences saved in localStorage on client
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
