'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Copy, Check, ExternalLink } from 'lucide-react'

interface ChatConfig {
  id?: string
  name: string
  color: string
  greeting: string
  system_prompt: string
  is_active: boolean
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const COLORS = ['#2563eb', '#2563eb', '#1d4ed8', '#475569', '#dc2626', '#0891b2', '#2563eb']
const COLOR_NAMES: Record<string, string> = {
  '#2563eb': 'Violet', '#2563eb': 'Blue', '#1d4ed8': 'Emerald',
  '#475569': 'Amber', '#dc2626': 'Red', '#0891b2': 'Cyan',
}

function ChatPreview({ config, chatbotId }: { config: ChatConfig; chatbotId: string | undefined }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([{ role: 'assistant', content: config.greeting }])
  }, [config.greeting])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || sending) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    const endpointId = chatbotId || 'preview'
    try {
      const res = await fetch(`/api/chatbot/${endpointId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || "I'm here to help!" }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, something went wrong." }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <p className="text-slate-500 text-xs mb-3">Live Preview</p>
      <div className="flex-1 flex items-end justify-end">
        <div className="w-[320px]">
          {open && (
            <div className="bg-slate-950 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl mb-3">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3" style={{ background: config.color }}>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">
                  {config.name[0]?.toUpperCase() || 'A'}
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{config.name}</p>
                  <p className="text-white/70 text-xs">Online now</p>
                </div>
                <button onClick={() => setOpen(false)} className="ml-auto text-white/70 hover:text-white text-lg leading-none">×</button>
              </div>

              {/* Messages */}
              <div className="h-64 overflow-y-auto p-3 space-y-2 bg-slate-950">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mr-2 mt-0.5" style={{ background: config.color }}>
                        {config.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className={`max-w-[220px] px-3 py-2 rounded-xl text-xs ${
                      m.role === 'user'
                        ? 'text-white rounded-br-sm'
                        : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                    }`} style={m.role === 'user' ? { background: config.color } : {}}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mr-2" style={{ background: config.color }}>
                      {config.name[0]?.toUpperCase()}
                    </div>
                    <div className="bg-slate-800 px-3 py-2 rounded-xl rounded-bl-sm">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-800 bg-slate-950">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Type a message…"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || sending}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
                  style={{ background: config.color }}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Chat bubble */}
          <div className="flex justify-end">
            <button
              onClick={() => setOpen(o => !o)}
              className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white text-xl"
              style={{ background: config.color }}
            >
              {open ? '×' : '💬'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatbotPage() {
  const [config, setConfig] = useState<ChatConfig>({
    name: 'Support Bot',
    color: '#2563eb',
    greeting: 'Hi there! 👋 How can I help you today?',
    system_prompt: 'You are a friendly business assistant. Help visitors with questions and try to capture their name and email for follow-up. Keep replies under 80 words.',
    is_active: true,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [chatbotId, setChatbotId] = useState<string | undefined>()
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'config' | 'embed'>('config')

  useEffect(() => {
    fetch('/api/chatbot')
      .then(r => r.json())
      .then(d => {
        if (d.config) {
          setConfig({
            name: d.config.name || config.name,
            color: d.config.color || config.color,
            greeting: d.config.greeting || config.greeting,
            system_prompt: d.config.system_prompt || config.system_prompt,
            is_active: d.config.is_active ?? true,
          })
          setChatbotId(d.config.id)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (k: keyof ChatConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setConfig(c => ({ ...c, [k]: e.target.value }))

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (data.config?.id) setChatbotId(data.config.id)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://coovex.com'
  const embedId = chatbotId || 'YOUR_CHATBOT_ID'
  const iframeCode = `<!-- CooVex Chat Widget -->\n<script>\n  (function(){\n    var iframe = document.createElement('iframe');\n    iframe.src = '${baseUrl}/embed/chat/${embedId}';\n    iframe.style.cssText = 'position:fixed;bottom:0;right:0;width:380px;height:520px;border:none;z-index:9999;';\n    iframe.allow = 'microphone';\n    document.body.appendChild(iframe);\n  })();\n</script>`

  function copyEmbed() {
    navigator.clipboard.writeText(iframeCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 h-full flex flex-col max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Chatbot Builder</h1>
          <p className="text-slate-400 text-sm mt-0.5">Build and deploy an AI chat widget for your website</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? 'Saving…' : 'Save Config'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Left: Config */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 self-start">
            {(['config', 'embed'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}>
                {t === 'config' ? '⚙️ Configure' : '🔗 Embed Code'}
              </button>
            ))}
          </div>

          {tab === 'config' ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Bot Name</label>
                <input value={config.name} onChange={set('name')} placeholder="Support Bot"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Chat Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setConfig(cfg => ({ ...cfg, color: c }))}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${config.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ background: c }}
                      title={COLOR_NAMES[c] || c}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Greeting Message</label>
                <textarea value={config.greeting} onChange={set('greeting')} rows={2}
                  placeholder="Hi there! 👋 How can I help you today?"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none" />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">AI Personality / System Prompt</label>
                <textarea value={config.system_prompt} onChange={set('system_prompt')} rows={5}
                  placeholder="You are a helpful assistant for [business name]. Help visitors with questions about our services..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none" />
                <p className="text-slate-600 text-xs mt-1">Tip: Include your business context, FAQs, and instructions to collect visitor name + email.</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div>
                  <p className="text-white text-sm font-medium">Active</p>
                  <p className="text-slate-500 text-xs">Show chat widget on your website</p>
                </div>
                <button
                  onClick={() => setConfig(c => ({ ...c, is_active: !c.is_active }))}
                  className={`w-11 h-6 rounded-full transition-colors relative ${config.is_active ? 'bg-blue-600' : 'bg-slate-700'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${config.is_active ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div>
                <p className="text-white font-medium text-sm mb-1">Embed on your website</p>
                <p className="text-slate-400 text-xs">Paste this script just before the <code className="text-blue-400">&lt;/body&gt;</code> tag of your site.</p>
              </div>

              <div className="relative">
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                  {iframeCode}
                </pre>
                <button
                  onClick={copyEmbed}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-lg border border-slate-700 transition-colors"
                >
                  {copied ? <><Check className="w-3 h-3 text-blue-400" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>

              {chatbotId && !chatbotId.startsWith('mock') && (
                <a
                  href={`/embed/chat/${chatbotId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Preview standalone embed page
                </a>
              )}

              <div className="p-4 bg-slate-950/50 border border-slate-800/60 rounded-xl">
                <p className="text-slate-400 text-xs leading-relaxed">
                  <strong className="text-slate-300">WordPress:</strong> Use the &quot;Custom HTML&quot; widget in Appearance → Widgets, or paste in your theme&apos;s footer.php.<br />
                  <strong className="text-slate-300">Shopify:</strong> Theme → Edit code → theme.liquid, paste before <code className="text-blue-400">&lt;/body&gt;</code>.<br />
                  <strong className="text-slate-300">Webflow:</strong> Project Settings → Custom Code → Footer Code.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col min-h-[500px]">
          <ChatPreview config={config} chatbotId={chatbotId} />
        </div>
      </div>
    </div>
  )
}
