import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { markOnboardingComplete } from '../actions'

const SIGNAL_COLORS: Record<string, string> = {
  urgent:      'border-red-200 bg-red-50',
  warning:     'border-amber-200 bg-amber-50',
  opportunity: 'border-violet-200 bg-violet-50',
  done:        'border-emerald-200 bg-emerald-50',
  insight:     'border-blue-200 bg-blue-50',
}

const SIGNAL_ICONS: Record<string, string> = {
  urgent: '❗', warning: '⚠️', opportunity: '💡', done: '✅', insight: '📊',
}

const SIGNAL_TEXT: Record<string, string> = {
  urgent: 'text-red-700', warning: 'text-amber-700', opportunity: 'text-violet-700',
  done: 'text-emerald-700', insight: 'text-blue-700',
}

export default async function ResultsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id, name')
    .eq('id', user.id)
    .single()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, health_score')
    .eq('workspace_id', profile?.current_workspace_id)
    .maybeSingle()

  const { data: signals } = business
    ? await supabase
        .from('agent_signals')
        .select('*')
        .eq('business_id', business.id)
        .eq('dismissed', false)
        .order('created_at', { ascending: false })
        .limit(3)
    : { data: [] }

  const { data: metrics } = business
    ? await supabase
        .from('business_metrics')
        .select('health_score')
        .eq('business_id', business.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const healthScore    = metrics?.health_score ?? 35
  const circumference  = 2 * Math.PI * 54
  const dashOffset     = circumference - (healthScore / 100) * circumference
  const scoreColor     = healthScore >= 80 ? '#059669' : healthScore >= 60 ? '#3b82f6' : healthScore >= 40 ? '#d97706' : '#dc2626'
  const scoreLabel     = healthScore >= 80 ? 'Great' : healthScore >= 60 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Needs Work'
  const scoreLabelColor = healthScore >= 80 ? 'text-emerald-600' : healthScore >= 60 ? 'text-blue-600' : healthScore >= 40 ? 'text-amber-600' : 'text-red-500'

  return (
    <div className="w-full max-w-2xl pt-6">
      {/* Step indicator — all filled */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div key={s} className="h-1.5 rounded-full flex-1 bg-violet-500" />
        ))}
      </div>

      {/* Inline header — no separate card, saves vertical space */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <p className="text-emerald-600 text-sm font-semibold">Agent Active</p>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Here&apos;s your first look</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Monitoring {business?.name || 'your business'} — here&apos;s what the agent found.
          </p>
        </div>
      </div>

      <div className="space-y-4">

        {/* Health Score + Signals */}
        <div className="grid grid-cols-5 gap-4">
          {/* Health score ring */}
          <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 shadow-sm">
            <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke={scoreColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div className="text-center -mt-2">
              <p className="text-3xl font-bold text-slate-900">{healthScore}</p>
              <p className="text-slate-400 text-xs">Health Score</p>
              <p className={`text-xs font-semibold mt-0.5 ${scoreLabelColor}`}>{scoreLabel}</p>
            </div>
          </div>

          {/* Signals */}
          <div className="col-span-3 space-y-2.5">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Initial Insights</p>
            {signals && signals.length > 0 ? (
              signals.map((signal: { id: string; type: string; title: string; body: string }) => (
                <div
                  key={signal.id}
                  className={`border rounded-xl p-3 ${SIGNAL_COLORS[signal.type] || 'border-slate-200 bg-slate-50'}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">{SIGNAL_ICONS[signal.type]}</span>
                    <div>
                      <p className={`text-sm font-semibold ${SIGNAL_TEXT[signal.type] || 'text-slate-900'}`}>{signal.title}</p>
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{signal.body}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-400 text-sm">Loading insights...</div>
            )}
          </div>
        </div>

        {/* What's next */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <p className="text-slate-700 font-semibold text-sm mb-3">What your AI agent will do next:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: '📡', text: 'Monitor channels every 24h' },
              { icon: '☀️', text: 'Daily briefing every morning' },
              { icon: '🚨', text: 'Instant alerts for urgent issues' },
              { icon: '🏆', text: 'Track competitors & trends' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-base">{item.icon}</span>
                <span className="text-slate-600 text-xs">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <form action={markOnboardingComplete}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-bold px-8 py-4 rounded-xl transition-all text-lg shadow-lg shadow-violet-200"
          >
            Go to Dashboard
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
