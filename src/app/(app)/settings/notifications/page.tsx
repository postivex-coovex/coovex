import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NotificationsClient from './notifications-client'

export const metadata: Metadata = { title: 'Notifications — Settings — CooVex' }

export default async function NotificationsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // preferences_json requires: ALTER TABLE profiles ADD COLUMN preferences_json jsonb DEFAULT '{}';
  // Until then, defaults are loaded from localStorage on the client.
  const prefs: Record<string, boolean> = {}

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/settings" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Settings</Link>
        <h1 className="text-2xl font-bold text-white mt-2">Notifications</h1>
        <p className="text-slate-400 text-sm mt-0.5">Control when and how your AI agent alerts you</p>
      </div>
      <NotificationsClient userId={user.id} initialPrefs={prefs} />
    </div>
  )
}
