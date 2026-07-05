import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  const firstName = profile?.name?.split(' ')[0] || 'there'

  return (
    <div className="w-full max-w-2xl pt-6 pb-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div key={s} className={`h-1.5 rounded-full flex-1 ${s === 1 ? 'bg-violet-500' : 'bg-slate-200'}`} />
        ))}
      </div>

      {/* ── Hero ── */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-full px-4 py-1.5 mb-5">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-violet-700 text-sm font-semibold">AI Agent Ready</span>
        </div>

        <h1 className="text-4xl font-extrabold text-slate-900 mb-4 leading-tight">
          Welcome, {firstName}!<br />
          <span style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Your AI Business Agent
          </span>{' '}
          is ready.
        </h1>

        <p className="text-slate-500 text-lg max-w-md mx-auto leading-relaxed">
          Answer a few quick questions and CooVex will start monitoring your business, scoring leads, and sending you daily insights — automatically.
        </p>
      </div>

      {/* ── What you need to provide ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">What you&apos;ll need (3 min)</p>
        <div className="space-y-3">
          {[
            {
              step: '1',
              icon: '🏢',
              title: 'Business basics',
              desc: 'Name, industry, country — takes 30 seconds',
              color: 'bg-blue-50 border-blue-100',
            },
            {
              step: '2',
              icon: '🔗',
              title: 'Your website & social links',
              desc: 'Website URL, LinkedIn, Facebook, Instagram — all optional',
              color: 'bg-violet-50 border-violet-100',
            },
            {
              step: '3',
              icon: '👥',
              title: 'Team members',
              desc: 'Invite colleagues — or skip and do it later',
              color: 'bg-emerald-50 border-emerald-100',
            },
          ].map((item) => (
            <div key={item.step} className={`flex items-center gap-4 rounded-xl border p-4 ${item.color}`}>
              <div className="w-10 h-10 rounded-xl bg-white border border-white/80 shadow-sm flex items-center justify-center text-xl flex-shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 font-semibold text-sm">{item.title}</p>
                <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
              </div>
              <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                <span className="text-slate-400 text-xs font-bold">{item.step}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── What you get ── */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { icon: '📡', title: 'Live Monitoring', desc: 'Competitors, reviews & market signals tracked 24/7' },
          { icon: '☀️', title: 'Daily Briefings', desc: 'Morning summary with your top 3 priorities' },
          { icon: '🎯', title: 'Lead Scoring', desc: 'AI ranks your leads so you focus on what converts' },
        ].map((item) => (
          <div key={item.title} className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
            <div className="text-2xl mb-2">{item.icon}</div>
            <p className="text-slate-900 font-semibold text-sm mb-1">{item.title}</p>
            <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* ── CTA ── */}
      <div className="text-center">
        <Link
          href="/onboarding/business"
          className="inline-flex items-center gap-3 bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-bold px-10 py-4 rounded-xl transition-all text-lg shadow-lg shadow-violet-200"
        >
          Start Setup — 3 min
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </Link>
        <p className="text-slate-400 text-sm mt-3">No credit card required · Cancel anytime</p>
      </div>
    </div>
  )
}
