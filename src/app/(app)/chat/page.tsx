'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
  action_url?: string | null
  tool_results?: Array<{ tool: string; result: unknown }>
}

const STARTER_PROMPTS = [
  'What should I focus on today to grow my business?',
  'Write me a LinkedIn post about our latest service',
  'Add a lead: Jane Smith from Acme Corp, jane@acme.com',
  'Show me my business stats',
  'What are my current agent alerts?',
  'Give me a 5-step content strategy for this month',
]

const ACTION_LABELS: Record<string, string> = {
  '/content': '→ View in Content',
  '/leads': '→ View Leads',
  '/dashboard': '→ Go to Dashboard',
  '/audit': '→ View Audit',
  '/analytics': '→ View Analytics',
  '/trends': '→ View Trends',
}

function getActionLabel(url: string) {
  if (ACTION_LABELS[url]) return ACTION_LABELS[url]
  if (url.startsWith('/leads/')) return '→ View Lead'
  return `→ Open`
}

export default function CoachPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI Business Coach. I can help you analyze data, write content, add leads, and take real actions in the platform. What would you like to do?",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoSentRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q && !autoSentRef.current) {
      autoSentRef.current = true
      send(q)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function send(text?: string) {
    const content = text || input.trim()
    if (!content || loading) return

    setInput('')
    const userMsg: Message = { role: 'user', content }
    setMessages(m => [...m, userMsg])
    setLoading(true)

    try {
      // Build history for context (last 10 messages, excluding initial greeting)
      const history = messages
        .slice(1) // skip initial greeting
        .map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history }),
      })

      if (!res.ok) throw new Error('Failed')
      const data = await res.json()

      setMessages(m => [...m, {
        role: 'assistant',
        content: data.reply || data.error || 'Something went wrong.',
        action_url: data.action_url || null,
        tool_results: data.tool_results || [],
      }])
    } catch {
      setMessages(m => [...m, {
        role: 'assistant',
        content: "I'm having trouble connecting. Make sure your Anthropic API key is configured in Settings.",
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            🤖 AI Business Coach
            <span className="bg-violet-600/20 text-violet-300 text-xs font-medium px-2 py-0.5 rounded-full">Actions enabled</span>
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Can create posts, add leads, pull data — ask it anything</p>
        </div>
        <button
          onClick={() => setMessages([{
            role: 'assistant',
            content: "Hi! I'm your AI Business Coach. I can help you analyze data, write content, add leads, and take real actions in the platform. What would you like to do?",
          }])}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
              msg.role === 'assistant' ? 'bg-violet-600/30 border border-violet-500/30' : 'bg-slate-700 border border-slate-600'
            }`}>
              {msg.role === 'assistant' ? '🤖' : '👤'}
            </div>
            <div className="max-w-2xl space-y-2">
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-none'
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
              }`}>
                {msg.content}
              </div>

              {/* Tool action button */}
              {msg.action_url && (
                <div>
                  <button
                    onClick={() => router.push(msg.action_url!)}
                    className="text-xs bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {getActionLabel(msg.action_url)}
                  </button>
                </div>
              )}

              {/* Tool result chips */}
              {msg.tool_results && msg.tool_results.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {msg.tool_results.map((tr, j) => (
                    <span key={j} className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-1 rounded-md">
                      ⚡ {tr.tool.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center">🤖</div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex gap-1 items-center h-5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Starter prompts */}
      {messages.length === 1 && (
        <div className="py-4 flex flex-wrap gap-2">
          {STARTER_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => send(p)}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs px-3 py-2 rounded-xl transition-colors text-left"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="py-4 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask anything or say 'write a LinkedIn post about...'"
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors"
            disabled={loading}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
        <p className="text-slate-700 text-xs mt-2 text-center">
          Can create posts · add leads · read signals · pull stats
        </p>
      </div>
    </div>
  )
}
