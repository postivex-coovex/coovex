'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

export function SyncAllButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/sync-memory/all', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setResult(`Synced ${data.synced}/${data.total}`)
        setTimeout(() => window.location.reload(), 800)
      } else {
        setResult('Failed')
      }
    } catch {
      setResult('Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-sm text-emerald-400">{result}</span>}
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Syncing...' : 'Sync All'}
      </button>
    </div>
  )
}

export function SyncOneButton({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setStatus('idle')
    setErrMsg(null)
    try {
      const res = await fetch(`/api/admin/sync-memory/${businessId}`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setStatus('done')
        setTimeout(() => window.location.reload(), 800)
      } else {
        setStatus('error')
        setErrMsg(data.error ?? `HTTP ${res.status}`)
        console.error('[SyncOneButton] error:', data)
      }
    } catch (e) {
      setStatus('error')
      setErrMsg(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {status === 'error' && errMsg && (
        <span className="text-[10px] text-red-400 max-w-[120px] truncate" title={errMsg}>{errMsg}</span>
      )}
      <button
        onClick={handleSync}
        disabled={loading || status === 'done'}
        className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        {status === 'done' ? 'Done ✓' : status === 'error' ? 'Retry' : loading ? '...' : 'Sync'}
      </button>
    </div>
  )
}
