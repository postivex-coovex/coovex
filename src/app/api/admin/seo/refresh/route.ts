import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Revalidate all SEO routes
  revalidatePath('/llms.txt')
  revalidatePath('/sitemap.xml')
  revalidatePath('/robots.txt')
  revalidatePath('/')

  return NextResponse.json({ ok: true, revalidated: ['/llms.txt', '/sitemap.xml', '/robots.txt', '/'] })
}
