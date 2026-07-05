'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, TrendingUp, Users, FileText, Zap } from 'lucide-react'

interface PortalData {
  business: { name: string; industry: string; country: string; health_score: number }
  wl: { brand_name: string | null; logo_url: string | null; primary_color: string; portal_welcome_message: string | null; hide_powered_by: boolean }
  metrics: { totalLeads: number; wonLeads: number; scheduledPosts: number; publishedPosts: number }
  signals: { id: string; type: string; title: string; created_at: string }[]
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D'
  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx="64" cy="64" r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
      <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 64 64)" style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x="64" y="60" textAnchor="middle" fill="white" fontSize="24" fontWeight="700" fontFamily="system-ui">{score}</text>
      <text x="64" y="78" textAnchor="middle" fill="#64748b" fontSize="12" fontFamily="system-ui">Grade {grade}</text>
    </svg>
  )
}

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('')
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then(p => {
      setToken(p.token)
      fetch(`/api/portal/${p.token}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) setError(d.error)
          else setData(d)
        })
        .catch(() => setError('Failed to load portal'))
        .finally(() => setLoading(false))
    })
  }, [params])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-white font-semibold">{error === 'Portal not found' ? 'Portal not found' : 'This portal is currently disabled'}</p>
          <p className="text-slate-500 text-sm mt-1">Please contact the agency for the correct link.</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { business, wl, metrics, signals } = data
  const brandName = wl.brand_name || 'CooVex'
  const color = wl.primary_color || '#7c3aed'

  return (
    <div className="min-h-screen bg-slate-950">
      <style>{`body { margin: 0; font-family: system-ui, sans-serif; }`}</style>

      {/* Header */}
      <header style={{ background: color }} className="px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          {wl.logo_url ? (
            <img src={wl.logo_url} alt={brandName} className="h-8 object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-semibold text-sm">{brandName}</span>
            </div>
          )}
          <div className="ml-auto text-white/70 text-sm">Client Portal</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">{business.name}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {wl.portal_welcome_message || `Here's your latest business performance overview from ${brandName}.`}
          </p>
        </div>

        {/* Health score + KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="sm:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center">
            <ScoreRing score={business.health_score} color={color} />
            <p className="text-slate-500 text-xs mt-2">Business Health</p>
          </div>
          <div className="sm:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { icon: Users,    label: 'Total Leads',    value: metrics.totalLeads,    sub: `${metrics.wonLeads} converted` },
              { icon: TrendingUp, label: 'Win Rate',     value: metrics.totalLeads > 0 ? `${Math.round((metrics.wonLeads / metrics.totalLeads) * 100)}%` : '—', sub: 'deals closed' },
              { icon: FileText, label: 'Content Posts',  value: metrics.publishedPosts, sub: `${metrics.scheduledPosts} scheduled` },
            ].map(k => (
              <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <k.icon className="w-5 h-5 mb-3" style={{ color }} />
                <p className="text-white text-2xl font-bold">{k.value}</p>
                <p className="text-slate-500 text-xs mt-0.5">{k.label}</p>
                <p className="text-slate-600 text-[10px]">{k.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Signals */}
        {signals.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold text-sm mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {signals.map(s => (
                <div key={s.id} className="flex items-start gap-3 py-3 border-t border-slate-800 first:border-0 first:pt-0">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm">{s.title}</p>
                    <p className="text-slate-600 text-xs mt-0.5">
                      {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {!wl.hide_powered_by && (
        <footer className="text-center py-6">
          <p className="text-slate-700 text-xs">Powered by <span className="text-slate-500">CooVex</span></p>
        </footer>
      )}
    </div>
  )
}
