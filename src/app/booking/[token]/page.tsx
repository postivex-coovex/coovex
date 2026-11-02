import type { Metadata } from 'next'
import { ManageBooking } from '@/components/meetings/manage-booking'

export const metadata: Metadata = { title: 'Your booking', robots: { index: false, follow: false } }

export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <ManageBooking token={token} />
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">Powered by CooVex</p>
      </div>
    </main>
  )
}
