import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { Tracker } from './tracker'
import ProposalActions from './proposal-actions'

export const dynamic = 'force-dynamic'

interface ProposalSection {
  heading: string
  body: string
}

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('share_token', token)
    .maybeSingle()

  if (!proposal) notFound()

  let sections: ProposalSection[] = []
  try {
    sections = JSON.parse(proposal.sections_json || '[]')
  } catch {
    sections = []
  }

  const date = new Date(proposal.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/p/${token}`

  return (
    <>
      <Tracker token={token} />
      <div className="min-h-screen bg-slate-50">
        {/* Header bar */}
        <div className="bg-slate-900 px-6 py-3 flex items-center justify-between print:hidden">
          <span className="text-white text-sm font-semibold tracking-wide">⚡ CooVex</span>
          <span className="text-slate-400 text-xs">Business Proposal</span>
        </div>

        {/* Status banner */}
        {proposal.status !== 'draft' && proposal.status !== 'sent' && proposal.status !== 'viewed' && (
          <div className={`px-6 py-3 text-center text-sm font-medium print:hidden ${
            proposal.status === 'accepted' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {proposal.status === 'accepted' ? '✅ You have accepted this proposal.' : '❌ This proposal has been declined.'}
          </div>
        )}

        {/* Document */}
        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* Title block */}
          <div className="bg-white border border-slate-200 rounded-2xl p-8 mb-6 shadow-sm">
            <div className="border-b-2 border-violet-600 pb-6 mb-6">
              <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-3">
                {proposal.title}
              </h1>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-500 text-sm">
                <span>Prepared for: <strong className="text-slate-700">{proposal.client_name}{proposal.client_company ? `, ${proposal.client_company}` : ''}</strong></span>
                <span>Date: <strong className="text-slate-700">{date}</strong></span>
                {proposal.budget   && <span>Budget: <strong className="text-slate-700">{proposal.budget}</strong></span>}
                {proposal.timeline && <span>Timeline: <strong className="text-slate-700">{proposal.timeline}</strong></span>}
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-8">
              {sections.map((s: ProposalSection, i: number) => (
                <div key={i}>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-3">
                    {s.heading}
                  </h2>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Footer */}
            {proposal.footer && (
              <div className="mt-10 pt-6 border-t border-slate-200">
                <p className="text-slate-400 text-sm italic">{proposal.footer}</p>
              </div>
            )}
          </div>

          {/* Receiver Action Panel */}
          {(proposal.status === 'sent' || proposal.status === 'viewed') && (
            <ProposalActions token={token} proposalId={proposal.id} clientName={proposal.client_name} />
          )}

          {/* Share URL for reference */}
          <div className="mt-6 text-center print:mt-12">
            <p className="text-slate-400 text-xs">
              This proposal is available at: <span className="text-slate-500">{shareUrl}</span>
            </p>
            <p className="text-slate-300 text-xs mt-1">Powered by CooVex</p>
          </div>
        </div>
      </div>
    </>
  )
}
