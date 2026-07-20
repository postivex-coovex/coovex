import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Accept Team Invite — CooVex' }

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  if (!token) redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in — redirect to login with callback
  if (!user) {
    redirect(`/login?next=/join?token=${token}`)
  }

  const service = createServiceClient()

  // Find the invite
  const { data: invite } = await service
    .from('workspace_members')
    .select('id, workspace_id, email, role, permissions, status')
    .eq('invite_token', token)
    .maybeSingle()

  if (!invite) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-2xl mb-2">🔗</p>
          <p className="text-white font-semibold">Invite link is invalid or expired.</p>
          <a href="/dashboard" className="text-violet-400 text-sm mt-3 block hover:underline">Go to Dashboard →</a>
        </div>
      </div>
    )
  }

  // Accept the invite: set user_id + status=active
  await service.from('workspace_members').update({
    user_id:      user.id,
    status:       'active',
    invite_token: null,
  }).eq('id', invite.id)

  // Switch user to this workspace
  await service.from('profiles')
    .update({ current_workspace_id: invite.workspace_id })
    .eq('id', user.id)

  redirect('/dashboard')
}
