'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bot, Trash2, Brain, Eye, Database } from 'lucide-react'

interface Fact {
  key: string
  value: string
}

interface Memory {
  id: string
  memory_type: string
  content: string
  created_at: string
  metadata?: Record<string, unknown>
}

interface Observation {
  title: string
  body: string
  signal_type: string
  created_at: string
  priority: string
}

const SIGNAL_COLORS: Record<string, string> = {
  opportunity: 'text-blue-400 bg-slate-950/40 border-slate-700/30',
  warning:     'text-slate-500 bg-slate-950/40 border-slate-700/30',
  action:      'text-blue-400 bg-slate-950/40 border-slate-700/30',
  insight:     'text-blue-400 bg-blue-950/40 border-blue-800/30',
  alert:       'text-red-400 bg-red-950/40 border-red-800/30',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs  = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}d ago`
  if (hrs  > 0) return `${hrs}h ago`
  return `${mins}m ago`
}

export default function AgentMemoryPage() {
  const [facts, setFacts] = useState<Fact[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'facts' | 'memory' | 'observations'>('facts')

  useEffect(() => {
    fetch('/api/settings/agent-memory')
      .then(r => r.json())
      .then(d => {
        setFacts((d.facts ?? []).filter(Boolean) as Fact[])
        setMemories(d.memories ?? [])
        setObservations(d.observations ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function deleteMemory(id: string) {
    await fetch('/api/settings/agent-memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setMemories(m => m.filter(x => x.id !== id))
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/settings" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-slate-700/40 flex items-center justify-center">
            <Brain className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Agent Memory</h1>
            <p className="text-slate-400 text-sm">What your AI agent knows about your business</p>
          </div>
        </div>
      </div>

      {/* Context explanation */}
      <div className="bg-slate-950/20 border border-slate-700/30 rounded-2xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Bot className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-slate-300">
            <p className="font-medium mb-1 text-blue-300">How the agent uses this</p>
            <p className="text-slate-400 text-xs leading-relaxed">
              Every AI action — brief generation, content creation, lead scoring, coach responses — is informed by
              the context below. The more complete your business profile, the more relevant and accurate the
              agent&apos;s outputs will be.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-5">
        {([
          { key: 'facts',        label: 'Business Facts',  icon: Database, count: facts.length },
          { key: 'memory',       label: 'Learned Context', icon: Brain,    count: memories.length },
          { key: 'observations', label: 'Observations',    icon: Eye,      count: observations.length },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              tab === t.key ? 'bg-white/20' : 'bg-slate-800'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-600">Loading agent memory…</div>
      ) : (
        <>
          {/* Business Facts */}
          {tab === 'facts' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              {facts.length === 0 ? (
                <div className="p-8 text-center text-slate-600">
                  <p>No business profile data yet.</p>
                  <Link href="/settings" className="text-blue-400 text-sm mt-2 inline-block">
                    Complete your business profile →
                  </Link>
                </div>
              ) : (
                <div>
                  {facts.map((f, i) => (
                    <div key={i} className={`flex items-start gap-4 px-5 py-3.5 ${i < facts.length - 1 ? 'border-b border-slate-800' : ''}`}>
                      <span className="text-slate-600 text-xs w-32 flex-shrink-0 mt-0.5">{f.key}</span>
                      <span className="text-white text-sm">{f.value}</span>
                    </div>
                  ))}
                  <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/50">
                    <Link href="/settings" className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                      Edit business profile →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Learned context (agent_memory table) */}
          {tab === 'memory' && (
            <div className="space-y-3">
              {memories.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-600">
                  <Brain className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No learned context yet.</p>
                  <p className="text-xs mt-1">As you use the AI Coach and run agent tasks, the agent builds up context about your business goals, preferences, and key decisions.</p>
                </div>
              ) : (
                memories.map(m => (
                  <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-blue-400 bg-slate-950/40 border border-slate-700/30 px-1.5 py-0.5 rounded-full capitalize">
                          {m.memory_type ?? 'context'}
                        </span>
                        <span className="text-slate-600 text-[10px]">{timeAgo(m.created_at)}</span>
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed">{m.content}</p>
                    </div>
                    <button
                      onClick={() => deleteMemory(m.id)}
                      className="text-slate-700 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Observations (recent signals) */}
          {tab === 'observations' && (
            <div className="space-y-3">
              {observations.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-600">
                  <Eye className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No observations yet.</p>
                  <p className="text-xs mt-1">The agent logs what it notices about your business as observations.</p>
                </div>
              ) : (
                observations.map((obs, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border capitalize ${SIGNAL_COLORS[obs.signal_type] ?? SIGNAL_COLORS.insight}`}>
                        {obs.signal_type}
                      </span>
                      {obs.priority === 'high' && (
                        <span className="text-[10px] text-red-400 bg-red-950/30 border border-red-800/30 px-1.5 py-0.5 rounded-full">high priority</span>
                      )}
                      <span className="text-slate-600 text-[10px] ml-auto">{timeAgo(obs.created_at)}</span>
                    </div>
                    <p className="text-white text-sm font-medium mb-0.5">{obs.title}</p>
                    <p className="text-slate-400 text-xs leading-relaxed">{obs.body}</p>
                  </div>
                ))
              )}
              {observations.length > 0 && (
                <div className="text-center">
                  <Link href="/dashboard" className="text-blue-400 text-xs hover:text-blue-300 transition-colors">
                    View all in Agent Inbox →
                  </Link>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
