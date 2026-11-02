import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { BookingFlow } from '@/components/meetings/booking-flow'
import { db, getActiveEvent, getHostBySlug } from '@/lib/meetings/service'

export const dynamic = 'force-dynamic'

type Params = Promise<{ username: string; event: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username, event } = await params
  const supabase = db()
  const host = await getHostBySlug(supabase, username)
  const ev = host ? await getActiveEvent(supabase, host.user_id, event) : null
  return { title: ev && host ? `${ev.title} with ${host.display_name || host.slug}` : 'Book a meeting' }
}

export default async function EventBookingPage({ params }: { params: Params }) {
  const { username, event } = await params
  const supabase = db()
  const host = await getHostBySlug(supabase, username)
  if (!host) notFound()
  const ev = await getActiveEvent(supabase, host.user_id, event)
  if (!ev) notFound()

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <Link href={`/book/${host.slug}`} className="text-sm text-slate-500 hover:text-slate-800">← All meeting types</Link>
        <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <BookingFlow
            username={host.slug}
            hostName={host.display_name || host.slug}
            color={host.brand_color}
            event={{
              slug: ev.slug,
              title: ev.title,
              description: ev.description,
              duration_min: ev.duration_min,
              location_type: ev.location_type,
              requires_confirmation: ev.requires_confirmation,
              questions: ev.questions,
            }}
          />
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">Powered by CooVex</p>
      </div>
    </main>
  )
}
