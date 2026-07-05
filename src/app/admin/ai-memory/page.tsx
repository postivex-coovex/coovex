import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SyncAllButton, SyncOneButton } from './sync-buttons'

export const dynamic = 'force-dynamic'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function freshnessColor(dateStr: string) {
  const hrs = (Date.now() - new Date(dateStr).getTime()) / 3600000
  if (hrs < 1) return 'text-emerald-400'
  if (hrs < 6) return 'text-blue-400'
  if (hrs < 24) return 'text-amber-400'
  return 'text-red-400'
}

export default async function AdminAIMemoryPage() {
  const supabase = await createServiceClient()

  // Get ALL businesses (not just those with memory)
  const { data: allBusinesses } = await supabase
    .from('businesses')
    .select('id, name, industry, health_score, workspace_id')
    .order('name')

  // Get all agent_memory rows
  const { data: memoryRows } = await supabase
    .from('agent_memory')
    .select('business_id, key, value_text, updated_at')
    .order('updated_at', { ascending: false })

  // Get workspace owners
  const workspaceIds = [...new Set((allBusinesses ?? []).map(b => b.workspace_id).filter(Boolean))]
  const { data: profiles } = workspaceIds.length > 0
    ? await supabase.from('profiles').select('id, name, email, current_workspace_id').in('current_workspace_id', workspaceIds)
    : { data: [] }

  type BizRow = { id: string; name: string; industry: string; health_score: number; workspace_id: string }
  type ProfRow = { id: string; name: string; email: string; current_workspace_id: string }
  type MemRow = { key: string; updated_at: string; value_text: string }

  // Index memory by business_id
  const memByBusiness: Record<string, MemRow[]> = {}
  for (const row of memoryRows ?? []) {
    if (!memByBusiness[row.business_id]) memByBusiness[row.business_id] = []
    memByBusiness[row.business_id].push({ key: row.key, updated_at: row.updated_at, value_text: row.value_text })
  }

  // Build entries for all businesses
  const entries = (allBusinesses ?? [] as BizRow[]).map(biz => {
    const prof = ((profiles ?? []) as ProfRow[]).find(p => p.current_workspace_id === biz.workspace_id) ?? null
    const keys = memByBusiness[biz.id] ?? []
    const contextRow = keys.find(k => k.key === 'business_context')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let context: Record<string, any> | null = null
    if (contextRow) {
      try { context = JSON.parse(contextRow.value_text) } catch { /* skip */ }
    }
    return { business: biz, profile: prof, keys, context, contextRow }
  })

  const businessesWithMemory = entries.filter(e => e.keys.length > 0).length
  const syncedInLastHour = entries.filter(e => {
    if (!e.contextRow) return false
    return (Date.now() - new Date(e.contextRow.updated_at).getTime()) < 3600000
  }).length
  const totalRows = (memoryRows ?? []).length
  const uniqueKeys = new Set((memoryRows ?? []).map(m => m.key)).size

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🧠 AI Agent Memory</h1>
          <p className="text-slate-500 text-sm mt-1">agent_memory table — all businesses&apos; AI context snapshots</p>
        </div>
        <SyncAllButton />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total businesses', value: entries.length, color: 'text-violet-400' },
          { label: 'With memory', value: businessesWithMemory, color: 'text-blue-400' },
          { label: 'Synced last hour', value: syncedInLastHour, color: 'text-emerald-400' },
          { label: 'Total memory rows', value: totalRows, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center">
          <p className="text-slate-400 text-sm">No businesses found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map(({ business, profile, keys, context, contextRow }) => {
            const ctx = context
            const profileId = profile?.id

            return (
              <div key={business.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-sm font-bold flex-shrink-0">
                      {(business.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{business.name}</p>
                      <p className="text-slate-500 text-xs">{profile?.email ?? 'no owner'} · {business.industry ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {contextRow ? (
                      <span className={`text-xs font-medium ${freshnessColor(contextRow.updated_at)}`}>
                        Synced {timeAgo(contextRow.updated_at)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">No memory</span>
                    )}
                    <SyncOneButton businessId={business.id} />
                    {profileId && (
                      <Link
                        href={`/admin/users/${profileId}`}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        View User →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Memory snapshot */}
                {ctx ? (
                  <div className="p-4 space-y-4">

                    {/* Row 1: Current state */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-slate-800/50 rounded-xl p-3">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Health Score</p>
                        <p className="text-2xl font-bold text-emerald-400">{ctx.business?.health_score ?? '—'}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-xl p-3">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Leads</p>
                        <p className="text-2xl font-bold text-blue-400">{ctx.leads?.total ?? 0}</p>
                        <p className="text-slate-600 text-[10px]">+{ctx.leads?.new_7d ?? 0} this week · {ctx.leads?.hot_count ?? 0} hot</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-xl p-3">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Pipeline</p>
                        <p className="text-lg font-bold text-green-400">${(ctx.pipeline?.total_value ?? 0).toLocaleString()}</p>
                        <p className="text-slate-600 text-[10px]">{ctx.pipeline?.open_deals ?? 0} open deals</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-xl p-3">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Audit</p>
                        {ctx.audit ? (
                          <>
                            <p className="text-2xl font-bold text-amber-400">{ctx.audit.latest_score}</p>
                            <p className="text-slate-600 text-[10px]">
                              Grade {ctx.audit.grade}
                              {ctx.audit.score_trend != null && (
                                <span className={ctx.audit.score_trend >= 0 ? ' text-emerald-400' : ' text-red-400'}>
                                  {' '}{ctx.audit.score_trend >= 0 ? '▲' : '▼'}{Math.abs(ctx.audit.score_trend)} vs prev
                                </span>
                              )}
                            </p>
                          </>
                        ) : (
                          <p className="text-slate-600 text-sm">Not run</p>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Quick metrics */}
                    <div className="grid grid-cols-6 gap-2">
                      {[
                        { label: 'Reviews', value: `${ctx.reviews?.total ?? 0} (${ctx.reviews?.unanswered ?? 0} new)` },
                        { label: 'Content (30d)', value: `${ctx.content?.published_30d ?? 0} pub · ${ctx.content?.drafts_pending ?? 0} drafts` },
                        { label: 'Integrations', value: `${ctx.integrations?.connected?.length ?? 0} connected` },
                        { label: 'Products', value: `${ctx.products?.active?.length ?? 0} active` },
                        { label: 'Proposals', value: `${ctx.proposals?.sent ?? 0} sent · ${ctx.proposals?.viewed ?? 0} viewed` },
                        { label: 'Task rate (7d)', value: ctx.tasks?.completion_rate_7d != null ? `${ctx.tasks.completion_rate_7d}%` : 'N/A' },
                      ].map(m => (
                        <div key={m.label} className="bg-slate-800/30 rounded-lg p-2">
                          <p className="text-slate-600 text-[10px]">{m.label}</p>
                          <p className="text-slate-300 text-xs font-medium mt-0.5">{String(m.value)}</p>
                        </div>
                      ))}
                    </div>

                    {/* Row 3: History sections */}
                    <div className="grid grid-cols-3 gap-3">

                      {/* Lead activity history */}
                      <div className="bg-slate-800/30 rounded-xl p-3">
                        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2 font-semibold">Lead Activity (90d)</p>
                        {ctx.lead_activity_history?.total_actions_90d > 0 ? (
                          <>
                            <p className="text-slate-300 text-xs mb-1.5">
                              {ctx.lead_activity_history.total_actions_90d} total actions
                            </p>
                            <div className="space-y-0.5">
                              {Object.entries(ctx.lead_activity_history.by_type ?? {}).slice(0, 5).map(([type, count]) => (
                                <div key={type} className="flex justify-between">
                                  <span className="text-slate-500 text-[10px]">{type}</span>
                                  <span className="text-slate-400 text-[10px] font-mono">{String(count)}</span>
                                </div>
                              ))}
                            </div>
                            {ctx.lead_activity_history.recent?.slice(0, 3).map((a: { lead_name: string; action: string; date: string }, i: number) => (
                              <p key={i} className="text-[10px] text-slate-600 mt-1">
                                {a.date}: {a.action} → {a.lead_name}
                              </p>
                            ))}
                          </>
                        ) : (
                          <p className="text-slate-600 text-[10px]">No lead actions yet</p>
                        )}
                      </div>

                      {/* Agent history */}
                      <div className="bg-slate-800/30 rounded-xl p-3">
                        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2 font-semibold">AI Agent History (90d)</p>
                        <p className="text-slate-300 text-xs mb-1">
                          {ctx.agent_history?.signals_90d ?? 0} signals detected · {ctx.agent_history?.actions_taken_90d ?? 0} actions taken
                        </p>
                        {Object.entries(ctx.agent_history?.signals_by_type ?? {}).slice(0, 4).map(([type, count]) => (
                          <div key={type} className="flex justify-between">
                            <span className="text-slate-500 text-[10px]">{type}</span>
                            <span className="text-slate-400 text-[10px] font-mono">{String(count)}</span>
                          </div>
                        ))}
                        {ctx.agent_history?.recent_actions?.slice(0, 3).map((a: { rule: string; date: string }, i: number) => (
                          <p key={i} className="text-[10px] text-slate-600 mt-0.5">{a.date}: {a.rule}</p>
                        ))}
                        {(ctx.agent_history?.signals_90d ?? 0) === 0 && (
                          <p className="text-slate-600 text-[10px]">No agent activity yet</p>
                        )}
                      </div>

                      {/* Chat + Goals */}
                      <div className="bg-slate-800/30 rounded-xl p-3 space-y-3">
                        <div>
                          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1.5 font-semibold">AI Chat History</p>
                          {ctx.chat_history?.total_sessions > 0 ? (
                            <>
                              <p className="text-slate-300 text-xs">{ctx.chat_history.total_sessions} sessions</p>
                              {ctx.chat_history.sessions?.slice(0, 2).map((s: { date: string; message_count: number; recent_user_queries: string[] }, i: number) => (
                                <div key={i} className="mt-1">
                                  <p className="text-slate-600 text-[10px]">{s.date} · {s.message_count} msgs</p>
                                  {s.recent_user_queries?.slice(0, 1).map((q: string, j: number) => (
                                    <p key={j} className="text-slate-500 text-[10px] truncate italic">&quot;{q}&quot;</p>
                                  ))}
                                </div>
                              ))}
                            </>
                          ) : (
                            <p className="text-slate-600 text-[10px]">No chat sessions yet</p>
                          )}
                        </div>
                        <div>
                          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1.5 font-semibold">Goals</p>
                          {ctx.goals?.active?.length > 0 ? (
                            ctx.goals.active.slice(0, 3).map((g: { title: string; progress_pct: number; status: string }, i: number) => (
                              <div key={i} className="flex justify-between items-center">
                                <span className="text-slate-500 text-[10px] truncate flex-1">{g.title}</span>
                                <span className="text-slate-400 text-[10px] font-mono ml-2">{g.progress_pct}%</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-600 text-[10px]">No goals set</p>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Audit score history */}
                    {ctx.audit?.score_history?.length > 1 && (
                      <div className="bg-slate-800/30 rounded-xl p-3">
                        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2 font-semibold">Audit Score History</p>
                        <div className="flex gap-2 flex-wrap">
                          {ctx.audit.score_history.map((h: { score: number; date: string }, i: number) => (
                            <div key={i} className="text-center">
                              <p className={`text-sm font-bold ${h.score >= 75 ? 'text-emerald-400' : h.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{h.score}</p>
                              <p className="text-slate-600 text-[10px]">{h.date}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Memory key tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {keys.map(k => (
                        <span key={k.key} className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                          {k.key}
                          <span className={`ml-1.5 ${freshnessColor(k.updated_at)}`}>{timeAgo(k.updated_at)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-slate-600 text-sm">
                    Memory not synced yet. Click &quot;Sync&quot; to generate AI context for this business.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {uniqueKeys > 0 && (
        <p className="text-slate-600 text-xs mt-4 text-center">{uniqueKeys} unique memory key types across {businessesWithMemory} businesses</p>
      )}
    </div>
  )
}
