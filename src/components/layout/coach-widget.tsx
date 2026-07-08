'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant'
  content: string
  action_url?: string | null
  steps?: string[]
  tools?: string[]
}

interface ToolStep {
  tool: string
  steps: string[]
  done: boolean
  result?: Record<string, unknown>
}

// ── Page context map ───────────────────────────────────────────────────────────
const PAGE_CONTEXTS: Record<string, { label: string; prompts: string[] }> = {
  '/dashboard':            { label: 'Agent Inbox',     prompts: ['What should I focus on today?', 'Show me my business stats', 'What are my biggest risks?'] },
  '/leads':                { label: 'Leads',           prompts: ['Find me 50 qualified leads', 'Which leads should I call first?', 'Move stale leads to contacted'] },
  '/leads/cold':           { label: 'Cold Outreach',   prompts: ['Write me a cold email sequence', 'How to improve reply rates?'] },
  '/leads/funnel':         { label: 'Lead Funnel',     prompts: ['Where are leads dropping off?', 'How to improve funnel conversion?'] },
  '/campaigns':            { label: 'Campaigns',       prompts: ['Create a newsletter campaign', 'Write a re-engagement campaign', 'Review my campaign strategy'] },
  '/content':              { label: 'Content',         prompts: ['Write a LinkedIn post about our service', 'Create 5 post ideas for this week'] },
  '/content/performance':  { label: 'Content Stats',   prompts: ['Which content is performing best?', 'What should I post more of?'] },
  '/competitors':          { label: 'Competitors',     prompts: ['Find my top 5 competitors', 'How can I differentiate from competitors?'] },
  '/proposals':            { label: 'Proposals',       prompts: ['Create a proposal for a client', 'How to improve win rate?'] },
  '/reviews':              { label: 'Reviews',         prompts: ['How to get more reviews?', 'Help me respond to a negative review'] },
  '/analytics':            { label: 'Analytics',       prompts: ['What do my analytics tell me?', 'Where should I invest more?'] },
  '/revenue':              { label: 'Revenue',         prompts: ['How to grow MRR faster?', 'What might be causing churn?'] },
  '/goals':                { label: 'Goals',           prompts: ['Am I on track to hit my goals?', 'What should my next goal be?'] },
  '/tools/marketing-plan': { label: 'Marketing Plan',  prompts: ['Create a campaign based on my marketing plan', 'Find leads matching my ICP'] },
  '/tools/business-plan':  { label: 'Business Plan',   prompts: ['What actions should I take this week?', 'Create content for a milestone'] },
  '/tools/swot':           { label: 'SWOT Analysis',   prompts: ['Find competitors based on my SWOT', 'Turn my opportunity into action'] },
  '/tools/pitch-deck':     { label: 'Pitch Deck',      prompts: ['Find investor-ready leads for my pitch', 'How to strengthen my pitch?'] },
  '/tools/valuation':      { label: 'Valuation',       prompts: ['How to increase my revenue multiple?', 'What metrics matter most for valuation?'] },
  '/tools/persona':        { label: 'ICP Builder',     prompts: ['Find 30 leads matching this ICP', 'Create a campaign for this persona'] },
}

function getPageCtx(pathname: string) {
  if (PAGE_CONTEXTS[pathname]) return PAGE_CONTEXTS[pathname]
  const match = Object.entries(PAGE_CONTEXTS).find(([k]) => pathname.startsWith(k + '/') || pathname === k)
  return match ? match[1] : {
    label: 'CooVex',
    prompts: ['What should I focus on today?', 'Find me 50 leads', 'Create a LinkedIn post'],
  }
}

// ── localStorage history ───────────────────────────────────────────────────────
const HISTORY_KEY = 'coach_history'
const MAX_MESSAGES = 100

function loadHistory(): Message[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}
function saveHistory(msgs: Message[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(msgs.slice(-MAX_MESSAGES))) } catch {}
}

// ── SSE parser ─────────────────────────────────────────────────────────────────
function parseSSE(chunk: string): Array<{ event: string; data: unknown }> {
  const events: Array<{ event: string; data: unknown }> = []
  let event = ''
  for (const line of chunk.split('\n')) {
    if (line.startsWith('event: ')) event = line.slice(7).trim()
    else if (line.startsWith('data: ')) {
      try { events.push({ event, data: JSON.parse(line.slice(6)) }) } catch {}
      event = ''
    }
  }
  return events
}

// ── Tool display names ─────────────────────────────────────────────────────────
const TOOL_LABELS: Record<string, string> = {
  find_and_save_leads: '🎯 Finding & saving leads',
  create_campaign:     '📧 Creating campaign',
  create_post:         '✍️ Writing post',
  create_proposal:     '📋 Creating proposal',
  discover_competitors:'🔍 Discovering competitors',
  get_business_overview:'📊 Fetching business data',
  get_leads:           '📋 Fetching leads',
  get_analytics:       '📈 Fetching analytics',
  update_lead:         '✏️ Updating lead',
  navigate_to:         '🔗 Navigating',
}

// ── Main Widget ────────────────────────────────────────────────────────────────
export function CoachWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [activeSteps, setActiveSteps] = useState<ToolStep[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const ctx = getPageCtx(pathname)

  useEffect(() => { setMessages(loadHistory()); setHydrated(true) }, [])
  useEffect(() => { if (hydrated) saveHistory(messages) }, [messages, hydrated])
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, open, activeSteps])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 150) }, [open])
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const send = useCallback(async (text?: string) => {
    const content = text ?? input.trim()
    if (!content || loading) return
    setInput('')
    setActiveSteps([])

    const userMsg: Message = { role: 'user', content }
    const history = messages
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/coach/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history: history.map(m => ({ role: m.role, content: m.content })),
          page_context: `${ctx.label} page (${pathname})`,
        }),
      })

      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let currentSteps: string[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const events = parseSSE(chunk)

        for (const { event, data } of events) {
          const d = data as Record<string, unknown>

          if (event === 'tool_start') {
            currentSteps = []
            setActiveSteps(prev => [...prev, { tool: d.tool as string, steps: [], done: false }])
          }

          if (event === 'step') {
            currentSteps = [...currentSteps, d.text as string]
            setActiveSteps(prev => prev.map((t, i) => i === prev.length - 1 ? { ...t, steps: currentSteps } : t))
          }

          if (event === 'tool_done') {
            setActiveSteps(prev => prev.map((t, i) =>
              i === prev.length - 1 ? { ...t, done: true, result: d.result as Record<string, unknown> } : t
            ))
            currentSteps = []
          }

          if (event === 'done') {
            const reply = d.reply as string
            const actionUrl = d.action_url as string | null
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: reply || 'Done!',
              action_url: actionUrl,
            }])
            setActiveSteps([])
          }

          if (event === 'error') {
            setMessages(prev => [...prev, { role: 'assistant', content: d.message as string || 'Something went wrong.' }])
            setActiveSteps([])
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
      setActiveSteps([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, loading, messages, ctx.label, pathname])

  function clearHistory() {
    setMessages([])
    try { localStorage.removeItem(HISTORY_KEY) } catch {}
  }

  const isEmpty = messages.length === 0 && !loading

  useEffect(() => {
    const handler = () => setOpen(v => !v)
    window.addEventListener('coovex:toggle-coach', handler)
    return () => window.removeEventListener('coovex:toggle-coach', handler)
  }, [])

  return (
    <>
      {/* Mobile backdrop */}
      {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

      {/* Panel */}
      <div className={`fixed top-0 right-0 h-full z-50 flex flex-col bg-slate-900 border-l border-slate-800 shadow-2xl transition-all duration-300 ease-in-out w-full md:w-[420px] ${open ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-sm">🧠</div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">AI Business Coach</p>
              <p className="text-violet-400 text-[10px] mt-0.5">{ctx.label} · Can take real actions</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button onClick={clearHistory} className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                Clear
              </button>
            )}
            <Link href="/chat" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
              Full
            </Link>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors">
              ✕
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* Empty state */}
          {isEmpty && (
            <div className="text-center pt-4">
              <div className="text-4xl mb-3">🧠</div>
              <p className="text-slate-300 font-semibold text-sm mb-1">AI Business Coach</p>
              <p className="text-slate-500 text-xs mb-1 leading-relaxed">I can <span className="text-violet-400">take real actions</span> — find leads, create campaigns, write posts, generate proposals, and more.</p>
              <p className="text-slate-600 text-[10px] mb-5">Your data is private. I only access your workspace.</p>
              <div className="space-y-2">
                <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-2">Try saying:</p>
                {ctx.prompts.map((p, i) => (
                  <button key={i} onClick={() => send(p)}
                    className="w-full text-left text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-violet-500/40 text-slate-300 hover:text-white px-3 py-2.5 rounded-xl transition-all">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message history */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-md bg-violet-600 flex items-center justify-center text-[10px] mb-1.5">🧠</div>
                )}
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' ? 'bg-violet-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
                {msg.action_url && (
                  <Link href={msg.action_url}
                    className="inline-flex items-center gap-1 mt-1.5 text-xs text-violet-400 hover:text-violet-300 bg-violet-600/10 border border-violet-500/20 px-3 py-1.5 rounded-lg transition-colors">
                    → Open in CooVex
                  </Link>
                )}
              </div>
            </div>
          ))}

          {/* Live agent steps */}
          {(loading || activeSteps.length > 0) && (
            <div className="space-y-2">
              {activeSteps.map((tool, i) => (
                <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {tool.done
                      ? <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">✓</span>
                      : <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin flex-shrink-0" />
                    }
                    <span className="text-xs font-medium text-slate-300">{TOOL_LABELS[tool.tool] ?? tool.tool}</span>
                  </div>
                  {tool.steps.map((s, j) => (
                    <p key={j} className="text-[11px] text-slate-500 pl-6 leading-relaxed">{s}</p>
                  ))}
                  {tool.done && tool.result && (
                    <div className="mt-1.5 pl-6">
                      {!!(tool.result.saved || tool.result.added || tool.result.count) && (
                        <span className="text-[11px] text-emerald-400 font-medium">
                          ✅ {String(tool.result.saved ?? tool.result.added ?? tool.result.count)} {tool.result.saved ? 'leads saved' : tool.result.added ? 'competitors added' : 'records'}
                        </span>
                      )}
                      {!!(tool.result.success && !tool.result.saved && !tool.result.added) && (
                        <span className="text-[11px] text-emerald-400">✅ Done</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {loading && activeSteps.every(t => t.done) && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1.5 items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick prompts after messages */}
          {!isEmpty && !loading && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ctx.prompts.slice(0, 2).map((p, i) => (
                <button key={i} onClick={() => send(p)}
                  className="text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">
                  {p}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-800 flex-shrink-0">
          <div className="flex gap-2 items-end bg-slate-800 border border-slate-700 focus-within:border-violet-500 rounded-xl transition-colors p-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={loading ? 'Agent is working…' : 'Ask coach to do something…'}
              disabled={loading}
              rows={1}
              className="flex-1 bg-transparent text-white text-sm placeholder-slate-600 resize-none focus:outline-none px-2 py-2 max-h-32 overflow-y-auto disabled:opacity-50"
              style={{ minHeight: '36px' }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-8 h-8 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white rounded-lg flex items-center justify-center transition-colors mb-0.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="text-slate-600 text-[10px] mt-1.5 text-center">Enter · Shift+Enter for newline · History saved locally</p>
        </div>
      </div>
    </>
  )
}
