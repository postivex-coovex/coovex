import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage({ searchParams }: { searchParams: Promise<{ code?: string; token_hash?: string; type?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const params = await searchParams

  // Handle Supabase auth callbacks that land on root
  if (params.code) {
    const next = params.type === 'email_change' ? '/settings' : '/dashboard'
    redirect(`/api/auth/callback?code=${params.code}&next=${next}`)
  }
  if (params.token_hash) {
    redirect(`/api/auth/callback?token_hash=${params.token_hash}&type=${params.type ?? 'magiclink'}&next=/dashboard`)
  }

  // Logged in → dashboard, logged out → login
  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
