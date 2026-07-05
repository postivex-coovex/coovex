import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { AdminCreditPanel } from './credit-panel'

export const dynamic = 'force-dynamic'

export default async function AdminWorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServiceClient()

  const { data: ws } = await supabase
    .from('workspaces')
    .select('*, ai_credits_balance, ai_credits_monthly, credits_reset_at')
    .eq('id', id)
    .single()
  if (!ws) notFound()

  const [
    { data: members },
    { data: business },
    { data: sub },
    { data: aiUsage },
  ] = await Promise.all([
    supabase.from('workspace_members').select('user_id, role, created_at').eq('workspace_id', id),
    supabase.from('businesses').select('*').eq('workspace_id', id).maybeSingle(),
    supabase.from('subscriptions').select('*').eq('workspace_id', id).maybeSingle(),
    supabase.from('ai_usage_log').select('feature, cost_usd, tokens_in, tokens_out, created_at').eq('workspace_id', id).order('created_at', { ascending: false }).limit(20),
  ])

  const userIds = (members || []).map(m => m.user_id)
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, name, email').in('id', userIds)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  const totalCost = (aiUsage || []).reduce((s, r) => s + Number(r.cost_usd), 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <Link href="/admin/workspaces" className="text-slate-500 hover:text-slate-300 text-sm">← Workspaces</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 text-lg font-bold mb-3">
              {(ws.name || 'W')[0].toUpperCase()}
            </div>
            <h1 className="text-white font-semibold">{ws.name || 'Unnamed Workspace'}</h1>
            <p className="text-slate-500 text-xs font-mono mt-0.5">{ws.id}</p>
            <div className="mt-4 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Plan</span><span className="text-violet-400 capitalize font-medium">{ws.plan}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Billing</span><span className="text-slate-300 capitalize">{ws.billing_status}</span></div>
              {ws.trial_ends_at && (
                <div className="flex justify-between"><span className="text-slate-500">Trial ends</span><span className="text-slate-300">{new Date(ws.trial_ends_at).toLocaleDateString()}</span></div>
              )}
              <div className="flex justify-between"><span className="text-slate-500">Created</span><span className="text-slate-300">{new Date(ws.created_at).toLocaleDateString()}</span></div>
            </div>
          </div>

          {sub && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Subscription</h2>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="text-emerald-400 capitalize">{sub.status}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Plan</span><span className="text-violet-400 capitalize">{sub.plan_name || sub.plan}</span></div>
                {sub.current_period_end && (
                  <div className="flex justify-between"><span className="text-slate-500">Renews</span><span className="text-slate-300">{new Date(sub.current_period_end).toLocaleDateString()}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Credits */}
          <AdminCreditPanel
            workspaceId={id}
            balance={ws.ai_credits_balance ?? 0}
            monthly={ws.ai_credits_monthly ?? 0}
            plan={ws.plan}
            resetAt={ws.credits_reset_at ?? null}
          />

          {business && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Business</h2>
              <p className="text-white font-medium text-sm">{business.name}</p>
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Industry</span><span className="text-slate-300">{business.industry || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Size</span><span className="text-slate-300">{business.size || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Country</span><span className="text-slate-300">{business.country || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Health Score</span><span className="text-emerald-400 font-medium">{business.health_score ?? '—'}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Members', value: (members || []).length },
              { label: 'AI Cost', value: `$${totalCost.toFixed(4)}` },
              { label: 'AI Calls', value: (aiUsage || []).length },
            ].map(s => (
              <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">{s.label}</p>
                <p className="text-white font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Members */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800">
              <h2 className="text-white font-semibold text-sm">Members</h2>
            </div>
            {(members || []).length === 0 ? (
              <div className="py-6 text-center text-slate-600 text-sm">No members</div>
            ) : (members || []).map((m, i) => {
              const p = profileMap[m.user_id]
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-slate-800/50">
                  <div className="w-7 h-7 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-300 text-xs font-bold">
                    {(p?.name || p?.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-200 text-sm">{p?.name || '—'}</p>
                    <p className="text-slate-500 text-xs">{p?.email}</p>
                  </div>
                  <span className="text-xs text-slate-500 capitalize">{m.role}</span>
                  <Link href={`/admin/users/${m.user_id}`} className="text-violet-400 hover:text-violet-300 text-xs">View</Link>
                </div>
              )
            })}
          </div>

          {/* Recent AI usage */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800">
              <h2 className="text-white font-semibold text-sm">AI Usage Log</h2>
            </div>
            {(aiUsage || []).length === 0 ? (
              <div className="py-6 text-center text-slate-600 text-sm">No AI usage recorded</div>
            ) : (aiUsage || []).slice(0, 10).map((row, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-2.5 border-b border-slate-800/40 text-xs">
                <span className="text-slate-400 w-32">{row.feature}</span>
                <span className="text-slate-500">{(row.tokens_in + row.tokens_out).toLocaleString()} tokens</span>
                <span className="text-emerald-400 ml-auto">${Number(row.cost_usd).toFixed(5)}</span>
                <span className="text-slate-600">{new Date(row.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
