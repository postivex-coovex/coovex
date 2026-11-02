import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Clock, Video } from 'lucide-react'
import { db, getHostBySlug } from '@/lib/meetings/service'
import type { MeetingEventType } from '@/lib/meetings/types'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params
  const host = await getHostBySlug(db(), username)
  return { title: host ? `Book a meeting with ${host.display_name || host.slug}` : 'Book a meeting' }
}

export default async function HostBookingPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const supabase = db()
  const host = await getHostBySlug(supabase, username)
  if (!host) notFound()

  const { data } = await supabase.from('meeting_event_types').select('*')
    .eq('user_id', host.user_id).eq('active', true).order('created_at', { ascending: true })
  const events = (data ?? []) as MeetingEventType[]
  const name = host.display_name || host.slug

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-white" style={{ backgroundColor: host.brand_color }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">{name}</h1>
          {host.bio && <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto whitespace-pre-line">{host.bio}</p>}
          <p className="mt-3 text-sm text-slate-500">Choose a meeting type to book a time.</p>
        </div>

        {events.length === 0 ? (
          <p className="text-center text-sm text-slate-500">No meeting types are available right now.</p>
        ) : (
          <div className="space-y-3">
            {events.map(ev => (
              <Link key={ev.id} href={`/book/${host.slug}/${ev.slug}`}
                className="block bg-white rounded-xl border border-slate-200 border-l-4 p-5 hover:shadow-md transition-shadow"
                style={{ borderLeftColor: ev.color }}>
                <h2 className="font-semibold text-slate-900">{ev.title}</h2>
                <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{ev.duration_min} min</span>
                  <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5" />
                    {ev.location_type === 'phone' ? 'Phone call' : ev.location_type === 'in_person' ? 'In person' : 'Online'}
                  </span>
                </div>
                {ev.description && <p className="mt-2 text-sm text-slate-600 line-clamp-2">{ev.description}</p>}
              </Link>
            ))}
          </div>
        )}
        <p className="mt-10 text-center text-xs text-slate-400">Powered by CooVex</p>
      </div>
    </main>
  )
}
