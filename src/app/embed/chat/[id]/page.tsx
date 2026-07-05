'use client'

import { useState, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function EmbedChatPage({ params }: { params: Promise<{ id: string }> }) {
  const [chatId, setChatId] = useState<string>('')
  const [config, setConfig] = useState({ name: 'AI Assistant', color: '#7c3aed', greeting: 'Hi! How can I help you today?' })
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    params.then(p => {
      setChatId(p.id)
      // Try to fetch config
      fetch(`/api/chatbot`)
        .then(r => r.json())
        .then(d => {
          if (d.config) {
            setConfig({
              name: d.config.name || 'AI Assistant',
              color: d.config.color || '#7c3aed',
              greeting: d.config.greeting || 'Hi! How can I help you today?',
            })
          }
        })
        .catch(() => {})
    })
  }, [params])

  useEffect(() => {
    if (config.greeting) {
      setMessages([{ role: 'assistant', content: config.greeting }])
    }
  }, [config.greeting])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || sending || !chatId) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)
    try {
      const res = await fetch(`/api/chatbot/${chatId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || "I'm here to help!" }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ background: 'transparent', width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '16px', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: transparent; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #475569; border-radius: 2px; }
        .msg-in { animation: fadeUp 0.2s ease; }
        @keyframes fadeUp { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
        .dot-bounce { animation: bounce 1s infinite; }
        @keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
      `}</style>

      {/* Chat panel */}
      {open && (
        <div style={{
          width: 348, marginBottom: 12, borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)', border: '1px solid #1e293b',
          display: 'flex', flexDirection: 'column', background: '#0f172a',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: config.color }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
              {config.name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{config.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Online · typically replies instantly</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>

          {/* Messages */}
          <div style={{ height: 340, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map((m, i) => (
              <div key={i} className="msg-in" style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
                {m.role === 'assistant' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: config.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {config.name[0]?.toUpperCase()}
                  </div>
                )}
                <div style={{
                  maxWidth: '72%', padding: '8px 12px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.role === 'user' ? config.color : '#1e293b',
                  color: '#f1f5f9', fontSize: 13, lineHeight: 1.5,
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: config.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                  {config.name[0]?.toUpperCase()}
                </div>
                <div style={{ background: '#1e293b', padding: '10px 14px', borderRadius: '16px 16px 16px 4px', display: 'flex', gap: 4 }}>
                  {[0,1,2].map(j => <div key={j} className="dot-bounce" style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748b', animationDelay: `${j * 0.15}s` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid #1e293b', background: '#0f172a', alignItems: 'center' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Type a message…"
              style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '8px 12px', color: '#f1f5f9', fontSize: 13, outline: 'none' }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              style={{ width: 36, height: 36, borderRadius: 10, background: config.color, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !input.trim() || sending ? 0.5 : 1 }}
            >
              <Send size={16} color="#fff" />
            </button>
          </div>

          {/* Powered by */}
          <div style={{ textAlign: 'center', padding: '6px 0', background: '#0f172a', borderTop: '1px solid #1e293b' }}>
            <span style={{ fontSize: 10, color: '#475569' }}>Powered by </span>
            <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>CooVex AI</span>
          </div>
        </div>
      )}

      {/* Bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 56, height: 56, borderRadius: '50%', background: config.color,
          border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, transition: 'transform 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? <span style={{ color: '#fff', fontSize: 24, lineHeight: 1 }}>×</span> : '💬'}
      </button>
    </div>
  )
}
