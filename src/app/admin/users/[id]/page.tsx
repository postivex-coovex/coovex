import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function MemoryRow({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null
  const display = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
  return (
    <div className="flex gap-3 text-xs py-1 border-b border-slate-800/40 last:border-0">
      <span className="text-slate-500 w-36 shrink-0 font-mono">{label}</span>
      <span className="text-slate-300 break-all font-mono">{display}</span>
    </div>
  )
}

function SectionCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border ${color} overflow-hidden`}>
      <div className={`px-4 py-2 border-b ${color} bg-slate-900/60`}>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{title}</span>
      </div>
      <div className="px-4 py-2 space-y-0">{children}</div>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServiceClient()

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single()
  if (!profile) notFound()

  const { data: workspace } = profile.current_workspace_id
    ? await supabase.from('workspaces').select('*').eq('id', profile.current_workspace_id).single()
    : { data: null }

  const { data: business } = workspace
    ? await supabase.from('businesses').select('*').eq('workspace_id', workspace.id).maybeSingle()
    : { data: null }

  const [
    { count: leadsCount },
    { count: postsCount },
    { count: auditsCount },
    { data: recentSignals },
    { data: aiUsage },
    { data: agentMemory },
  ] = await Promise.all([
    business ? supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id) : Promise.resolve({ count: 0 }),
    business ? supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business.id) : Promise.resolve({ count: 0 }),
    business ? supabase.from('audits').select('*', { count: 'exact', head: true }).eq('business_id', business.id) : Promise.resolve({ count: 0 }),
    business ? supabase.from('agent_signals').select('type, title, created_at').eq('business_id', business.id).order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    workspace ? supabase.from('ai_usage_log').select('feature, cost_usd, tokens_in, tokens_out, created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    business ? supabase.from('agent_memory').select('key, value_text, updated_at').eq('business_id', business.id).order('key') : Promise.resolve({ data: [] }),
  ])

  const totalCost = (aiUsage || []).reduce((s, r) => s + Number(r.cost_usd), 0)

  // Parse business_context memory
  const contextRow = (agentMemory || []).find(m => m.key === 'business_context')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ctx: Record<string, any> | null = null
  try {
    if (contextRow?.value_text) ctx = JSON.parse(contextRow.value_text)
  } catch { ctx = null }

  const otherMemory = (agentMemory || []).filter(m => m.key !== 'business_context')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <Link href="/admin/users" className="text-slate-500 hover:text-slate-300 text-sm">← Users</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="space-y-4">
          {/* Profile */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="w-12 h-12 rounded-full bg-violet-600 flex items-center justify-center text-white text-lg font-bold mb-3">
              {(profile.name || profile.email || '?')[0].toUpperCase()}
            </div>
            <h1 className="text-white font-semibold">{profile.name || '—'}</h1>
            <p className="text-slate-400 text-sm">{profile.email}</p>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Joined</span><span className="text-slate-300">{new Date(profile.created_at).toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Language</span><span className="text-slate-300">{profile.language || 'en'}</span></div>
              <div className="flex justify-between">
                <span className="text-slate-500">Onboarding</span>
                <span className={profile.onboarding_completed ? 'text-emerald-400' : 'text-amber-400'}>
                  {profile.onboarding_completed ? '✓ Done' : 'Incomplete'}
                </span>
              </div>
            </div>
          </div>

          {workspace && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Workspace</h2>
              <p className="text-white font-medium text-sm">{workspace.name}</p>
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Plan</span><span className="text-violet-400 font-medium capitalize">{workspace.plan}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Billing</span><span className="text-slate-300 capitalize">{workspace.billing_status}</span></div>
              </div>
            </div>
          )}

          {business && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Business</h2>
              <p className="text-white font-medium text-sm">{business.name}</p>
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Industry</span><span className="text-slate-300">{business.industry}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Size</span><span className="text-slate-300">{business.size}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Country</span><span className="text-slate-300">{business.country}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Health Score</span><span className="text-emerald-400 font-medium">{business.health_score}</span></div>
              </div>
            </div>
          )}

          {/* Memory keys list */}
          {(agentMemory || []).length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Memory Keys</h2>
              <div className="space-y-2">
                {(agentMemory || []).map(m => (
                  <div key={m.key} className="flex items-center justify-between">
                    <span className="text-slate-300 text-xs font-mono">{m.key}</span>
                    <span className="text-slate-600 text-[10px]">{timeAgo(m.updated_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right columns (2) ── */}
        <div className="col-span-2 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Leads', value: leadsCount ?? 0 },
              { label: 'Posts', value: postsCount ?? 0 },
              { label: 'Audits', value: auditsCount ?? 0 },
              { label: 'AI Cost', value: `$${totalCost.toFixed(4)}` },
            ].map(s => (
              <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">{s.label}</p>
                <p className="text-white font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* ── AI AGENT MEMORY ── */}
          <div className="bg-slate-900 border border-violet-500/30 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-violet-500/20 flex items-center justify-between bg-violet-500/5">
              <div>
                <h2 className="text-violet-300 font-semibold text-sm">🧠 AI Agent Memory</h2>
                <p className="text-slate-500 text-xs mt-0.5">agent_memory table — what the AI knows about this business</p>
              </div>
              {contextRow && (
                <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded-full">
                  Synced {timeAgo(contextRow.updated_at)}
                </span>
              )}
            </div>

            {!business ? (
              <div className="py-8 text-center text-slate-600 text-sm">No business found for this user</div>
            ) : !ctx ? (
              <div className="py-8 text-center">
                <p className="text-slate-500 text-sm">No memory synced yet</p>
                <p className="text-slate-600 text-xs mt-1">User must visit Agent Inbox to trigger first sync</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">

                {/* Business */}
                <SectionCard title="📊 Business" color="border-slate-700">
                  <MemoryRow label="name" value={ctx.business?.name} />
                  <MemoryRow label="industry" value={ctx.business?.industry} />
                  <MemoryRow label="health_score" value={ctx.business?.health_score} />
                  <MemoryRow label="target_customer" value={ctx.business?.target_customer} />
                  <MemoryRow label="country" value={ctx.business?.country} />
                  <MemoryRow label="website_url" value={ctx.business?.website_url} />
                  <MemoryRow label="description" value={ctx.business?.description} />
                </SectionCard>

                {/* Audit */}
                <SectionCard title="🔍 Audit" color="border-amber-500/20">
                  {ctx.audit ? (
                    <>
                      <MemoryRow label="latest_score" value={`${ctx.audit.latest_score}/100 (${ctx.audit.grade})`} />
                      <MemoryRow label="latest_date" value={ctx.audit.latest_date?.split('T')[0]} />
                      <MemoryRow label="summary" value={ctx.audit.summary} />
                      <MemoryRow label="critical_issues" value={ctx.audit.critical_issues?.length ? ctx.audit.critical_issues : 'none'} />
                      <MemoryRow label="wins" value={ctx.audit.wins?.length ? ctx.audit.wins : 'none'} />
                      <MemoryRow label="score_history" value={ctx.audit.history?.map((h: { date: string; score: number }) => `${h.date}: ${h.score}`).join(' → ')} />
                    </>
                  ) : (
                    <div className="text-slate-600 text-xs py-2">No audit run yet</div>
                  )}
                </SectionCard>

                {/* Leads */}
                <SectionCard title="👥 Leads" color="border-blue-500/20">
                  <MemoryRow label="total" value={ctx.leads?.total} />
                  <MemoryRow label="new_7d" value={ctx.leads?.new_7d} />
                  <MemoryRow label="new_30d" value={ctx.leads?.new_30d} />
                  <MemoryRow label="hot_count (score≥70)" value={ctx.leads?.hot_count} />
                  {ctx.leads?.hot_leads?.length > 0 && (
                    <MemoryRow label="hot_leads" value={ctx.leads.hot_leads.map((l: { name: string; score: number; stage: string }) => `${l.name} (${l.score}, ${l.stage})`).join(', ')} />
                  )}
                  <MemoryRow label="by_stage" value={Object.entries(ctx.leads?.by_stage ?? {}).map(([s, n]) => `${s}:${n}`).join(', ') || 'none'} />
                  <MemoryRow label="by_source" value={Object.entries(ctx.leads?.by_source ?? {}).map(([s, n]) => `${s}:${n}`).join(', ') || 'none'} />
                </SectionCard>

                {/* Reviews */}
                <SectionCard title="⭐ Reviews" color="border-yellow-500/20">
                  <MemoryRow label="total" value={ctx.reviews?.total} />
                  <MemoryRow label="avg_rating" value={ctx.reviews?.avg_rating ? `${ctx.reviews.avg_rating}/5` : 'N/A'} />
                  <MemoryRow label="unanswered" value={ctx.reviews?.unanswered} />
                  <MemoryRow label="negative_unanswered" value={ctx.reviews?.negative_unanswered} />
                </SectionCard>

                {/* Content */}
                <SectionCard title="📝 Content" color="border-emerald-500/20">
                  <MemoryRow label="published_30d" value={ctx.content?.published_30d} />
                  <MemoryRow label="drafts_pending" value={ctx.content?.drafts_pending} />
                  <MemoryRow label="channels_active" value={ctx.content?.channels_active?.join(', ') || 'none'} />
                </SectionCard>

                {/* Pipeline */}
                <SectionCard title="💰 Pipeline" color="border-green-500/20">
                  <MemoryRow label="open_deals" value={ctx.pipeline?.open_deals} />
                  <MemoryRow label="total_value" value={ctx.pipeline?.total_value ? `$${Number(ctx.pipeline.total_value).toLocaleString()}` : '$0'} />
                  {ctx.pipeline?.deals?.length > 0 && (
                    <MemoryRow label="deals" value={ctx.pipeline.deals.map((d: { name: string; value: number }) => `${d.name}: $${d.value}`).join(', ')} />
                  )}
                </SectionCard>

                {/* Products */}
                <SectionCard title="📦 Products" color="border-pink-500/20">
                  <MemoryRow label="total" value={ctx.products?.total} />
                  {ctx.products?.active?.length > 0 ? (
                    <MemoryRow label="active" value={ctx.products.active.map((p: { name: string; type: string }) => `${p.name} (${p.type})`).join(', ')} />
                  ) : (
                    <div className="text-slate-600 text-xs py-1">No active products</div>
                  )}
                </SectionCard>

                {/* Integrations */}
                <SectionCard title="🔌 Integrations" color="border-cyan-500/20">
                  <MemoryRow label="connected" value={ctx.integrations?.connected?.join(', ') || 'none'} />
                  <MemoryRow label="disconnected" value={ctx.integrations?.disconnected?.join(', ') || 'none'} />
                </SectionCard>

                {/* Campaigns */}
                <SectionCard title="📧 Campaigns (30d)" color="border-orange-500/20">
                  <MemoryRow label="total_30d" value={ctx.campaigns?.total_30d} />
                  {ctx.campaigns?.recent?.length > 0 && (
                    <MemoryRow label="recent" value={ctx.campaigns.recent.map((c: { name: string; status: string }) => `${c.name} (${c.status})`).join(', ')} />
                  )}
                </SectionCard>

                {/* Tasks */}
                <SectionCard title="✅ Task Completion (7d)" color="border-violet-500/20">
                  <MemoryRow label="completion_rate" value={ctx.tasks?.completion_rate_7d !== null ? `${ctx.tasks.completion_rate_7d}%` : 'no data'} />
                  <MemoryRow label="completed_7d" value={ctx.tasks?.completed_7d} />
                  <MemoryRow label="total_7d" value={ctx.tasks?.total_7d} />
                </SectionCard>

                {/* Competitors */}
                {ctx.competitors?.length > 0 && (
                  <SectionCard title="🎯 Competitors" color="border-red-500/20">
                    <MemoryRow label="tracked" value={ctx.competitors.map((c: { name: string }) => c.name).join(', ')} />
                  </SectionCard>
                )}

                {/* Website Intel */}
                {ctx.business?.website_intel && (
                  <SectionCard title="🌐 Website Intel" color="border-slate-600">
                    {Object.entries(ctx.business.website_intel as Record<string, unknown>).slice(0, 8).map(([k, v]) => (
                      <MemoryRow key={k} label={k} value={Array.isArray(v) ? (v as string[]).join(', ') : v} />
                    ))}
                  </SectionCard>
                )}
              </div>
            )}
          </div>

          {/* Other memory keys */}
          {otherMemory.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800">
                <h2 className="text-slate-300 font-semibold text-sm">Other Memory Keys</h2>
              </div>
              <div className="divide-y divide-slate-800/50">
                {otherMemory.map(m => {
                  let parsed: unknown = null
                  try { parsed = JSON.parse(m.value_text) } catch { parsed = m.value_text }
                  return (
                    <div key={m.key} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-violet-400 text-xs font-mono font-bold">{m.key}</span>
                        <span className="text-slate-600 text-[10px]">{timeAgo(m.updated_at)}</span>
                      </div>
                      <pre className="text-slate-400 text-[11px] font-mono whitespace-pre-wrap break-all bg-slate-950 rounded-lg p-3 max-h-48 overflow-auto">
                        {typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : String(parsed)}
                      </pre>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent signals */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800">
              <h2 className="text-white font-semibold text-sm">Recent Agent Signals</h2>
            </div>
            {(recentSignals || []).length === 0 ? (
              <div className="py-6 text-center text-slate-600 text-sm">No signals yet</div>
            ) : (recentSignals || []).map((s: { type: string; title: string; created_at: string }, i: number) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-slate-800/50">
                <span className="text-xs font-medium capitalize text-slate-400 w-20">{s.type}</span>
                <span className="text-slate-300 text-sm flex-1">{s.title}</span>
                <span className="text-slate-600 text-xs">{new Date(s.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>

          {/* AI usage */}
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
