'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Check, AlertCircle } from 'lucide-react'

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'joining' | 'joined' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    params.then(p => {
      setToken(p.token)
      // Decode token client-side to show role
      try {
        const payload = JSON.parse(atob(p.token.replace(/-/g, '+').replace(/_/g, '/')))
        setRole(payload.r || 'member')
        if (Date.now() > payload.exp) {
          setStatus('error')
          setMessage('This invite link has expired. Ask your team admin to send a new one.')
          return
        }
      } catch {
        setStatus('error')
        setMessage('Invalid invite link.')
        return
      }
      setStatus('ready')
    })
  }, [params])

  async function accept() {
    setStatus('joining')
    const res = await fetch(`/api/invites/${token}/accept`, { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      setStatus('joined')
      setTimeout(() => router.push('/dashboard'), 1500)
    } else if (res.status === 401) {
      // Not logged in — redirect to signup with token
      router.push(`/signup?invite=${token}`)
    } else {
      setStatus('error')
      setMessage(data.error || 'Failed to join workspace.')
    }
  }

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin — manage team, all features',
    member: 'Member — create content, leads, reviews',
    viewer: 'Viewer — read-only access',
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <style>{`body { margin: 0; font-family: system-ui, sans-serif; }`}</style>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">CooVex</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          {status === 'loading' && (
            <div className="flex justify-center">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {status === 'ready' && (
            <>
              <div className="w-16 h-16 bg-violet-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-violet-400" />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">You&apos;ve been invited!</h1>
              <p className="text-slate-400 text-sm mb-1">Join a CooVex workspace as:</p>
              <p className="text-violet-300 font-medium mb-6">{ROLE_LABELS[role] || role}</p>
              <button
                onClick={accept}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 rounded-xl transition-colors"
              >
                Accept Invitation
              </button>
              <p className="text-slate-600 text-xs mt-4">
                You&apos;ll be signed in or prompted to create a free account.
              </p>
            </>
          )}

          {status === 'joining' && (
            <>
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white font-medium">Joining workspace…</p>
            </>
          )}

          {status === 'joined' && (
            <>
              <div className="w-16 h-16 bg-emerald-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-white font-bold text-lg mb-2">Welcome to the team! 🎉</h2>
              <p className="text-slate-400 text-sm">Redirecting to your dashboard…</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-white font-bold text-lg mb-2">Invite Error</h2>
              <p className="text-slate-400 text-sm">{message}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
