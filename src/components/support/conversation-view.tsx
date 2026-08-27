'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft, Mail, MessageSquare, Globe, Send, Sparkles, Check,
  ChevronDown, Loader2, X, ExternalLink, Copy, Tag,
} from 'lucide-react'
import type { SupportConversation, SupportMessage, SupportProperty } from '@/lib/support/types'
import { createClient } from '@/lib/supabase/client'

interface Props {
  conversation: SupportConversation & { support_properties: SupportProperty }
  messages: SupportMessage[]
}

const SOURCE_CONFIG = {
  widget: { label: 'Widget', icon: MessageSquare, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  email:  { label: 'Email',  icon: Mail,          color: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300' },
  api:    { label: 'API',    icon: Globe,         color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  system: { label: 'System', icon: Tag,           color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
}

function fmt(date: string) {
  return new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function MessageBubble({ msg }: { msg: SupportMessage }) {
  const isAgent = msg.sender_type === 'agent' || msg.sender_type === 'ai'
  const srcCfg = SOURCE_CONFIG[msg.source as keyof typeof SOURCE_CONFIG] || SOURCE_CONFIG.widget
  const SrcIcon = srcCfg.icon

  return (
    <div className={`flex ${isAgent ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isAgent ? '' : ''}`}>
        {/* Sender info */}
        <div className={`flex items-center gap-2 mb-1 text-xs text-slate-400 ${isAgent ? 'justify-end' : ''}`}>
          {!isAgent && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${srcCfg.color}`}>
              <SrcIcon className="w-2.5 h-2.5" />
              {srcCfg.label}
            </span>
          )}
          <span>{msg.sender_name || msg.sender_email || (isAgent ? 'Support Team' : 'Customer')}</span>
          <span>{fmt(msg.created_at)}</span>
          {msg.sender_type === 'ai' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-[10px] font-semibold">
              <Sparkles className="w-2.5 h-2.5" />
              AI
            </span>
          )}
        </div>
        {/* Bubble */}
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isAgent
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-sm'
        }`}>
          {msg.content && <p>{msg.content}</p>}
          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
            <div className={`flex flex-wrap gap-2 ${msg.content ? 'mt-2' : ''}`}>
              {(msg.attachments as Array<{ url: string; name: string; type: string; size: number }>).map((a, i) => (
                a.type?.startsWith('image/') ? (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={a.url} alt={a.name}
                      className="w-24 h-20 object-cover rounded-lg border border-black/10 hover:opacity-90 transition-opacity cursor-pointer"
                    />
                  </a>
                ) : (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" download
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium max-w-[200px] truncate transition-opacity hover:opacity-80 ${
                      isAgent ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}>
                    📎 <span className="truncate">{a.name}</span>
                  </a>
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ConversationView({ conversation: initial, messages: initialMessages }: Props) {
  const router = useRouter()
  const [conv, setConv] = useState(initial)
  const [messages, setMessages] = useState<SupportMessage[]>(initialMessages)
  const [replyText, setReplyText] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [sending, setSending] = useState(false)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prop = conv.support_properties
  const hasSMTP = !!(prop?.smtp_host && prop?.smtp_user)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime — subscribe to new messages on this conversation
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`conv-messages-${conv.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${conv.id}` },
        (payload) => {
          const newMsg = payload.new as SupportMessage
          // Ignore messages we just sent ourselves (agent type)
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conv.id])

  async function sendReply() {
    if (!replyText.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/support/conversations/${conv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyText, send_email: sendEmail && hasSMTP }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessages(m => [...m, data.message])
      setReplyText('')
      if (data.emailSent) toast.success('Reply sent via email')
      else if (sendEmail && !hasSMTP) toast.info('Message saved — configure SMTP to send email replies')
      else toast.success('Reply saved')
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  async function generateAiReply() {
    setGeneratingAi(true)
    try {
      const res = await fetch(`/api/support/conversations/${conv.id}/ai-reply`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setReplyText(data.reply)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setGeneratingAi(false)
    }
  }

  async function updateStatus(status: string) {
    setStatusOpen(false)
    const res = await fetch(`/api/support/conversations/${conv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const data = await res.json()
      setConv(c => ({ ...c, status: data.status }))
      toast.success(`Status → ${status}`)
    }
  }

  const srcCfg = SOURCE_CONFIG[conv.source as keyof typeof SOURCE_CONFIG] || SOURCE_CONFIG.widget
  const SrcIcon = srcCfg.icon

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-100px)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/support')}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: prop?.widget_color || '#2563eb' }} />
              <span className="text-xs font-semibold text-slate-500">{prop?.name}</span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${srcCfg.color}`}>
                <SrcIcon className="w-2.5 h-2.5" />{srcCfg.label}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {conv.customer_name || conv.customer_email || 'Anonymous visitor'}
            </p>
            {conv.customer_email && (
              <p className="text-xs text-slate-400">{conv.customer_email}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status dropdown */}
          <div className="relative">
            <button onClick={() => setStatusOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              {conv.status}
              <ChevronDown className="w-3 h-3" />
            </button>
            {statusOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-10 overflow-hidden">
                {(['open','pending','closed','spam'] as const).map(s => (
                  <button key={s} onClick={() => updateStatus(s)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          {conv.customer_email && (
            <button onClick={() => { navigator.clipboard.writeText(conv.customer_email!); toast.success('Email copied') }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400" title="Copy email">
              <Copy className="w-4 h-4" />
            </button>
          )}
          {(conv.metadata as any)?.url && (
            <a href={(conv.metadata as any).url} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400" title="Open source page">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Conversation info bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-400 flex-shrink-0">
        <span>Subject: <span className="text-slate-600 dark:text-slate-300">{conv.subject || 'No subject'}</span></span>
        {conv.customer_phone && <span>Phone: {conv.customer_phone}</span>}
        <span>Started: {fmt(conv.created_at)}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No messages yet</div>
        ) : (
          messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <textarea
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          placeholder="Type your reply…"
          rows={4}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={generateAiReply}
              disabled={generatingAi}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
            >
              {generatingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-violet-500" />}
              AI Reply
            </button>
            {replyText && (
              <button onClick={() => setReplyText('')}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {conv.customer_email && (
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                <div onClick={() => setSendEmail(v => !v)}
                  className={`w-8 h-4.5 rounded-full transition-colors relative cursor-pointer ${sendEmail && hasSMTP ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${sendEmail && hasSMTP ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </div>
                <Mail className="w-3.5 h-3.5" />
                {hasSMTP ? 'Send email' : 'No SMTP'}
              </label>
            )}
            <button
              onClick={sendReply}
              disabled={sending || !replyText.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending…' : 'Send Reply'}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">Ctrl+Enter to send</p>
      </div>
    </div>
  )
}
