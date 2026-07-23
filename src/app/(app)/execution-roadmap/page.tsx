import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Execution Roadmap — CooVex' }

export default async function ExecutionRoadmapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6 max-w-3xl mx-auto mt-12 text-center">
      <div className="text-5xl mb-4">🗺️</div>
      <h1 className="text-2xl font-bold text-white mb-2">Execution Roadmap</h1>
      <p className="text-slate-400 text-sm mb-4">Your AI-generated step-by-step execution plan based on your business goals and audit results.</p>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-full text-blue-400 text-xs font-semibold mb-4">
          Coming Soon
        </div>
        <p className="text-slate-500 text-sm">This feature is in development. It will generate a prioritized execution roadmap based on your audit score, GEO gaps, and business goals.</p>
      </div>
    </div>
  )
}
