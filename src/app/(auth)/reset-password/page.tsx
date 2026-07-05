'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [ready, setReady]       = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Parse hash fragment manually — server can't see it
    const hash = window.location.hash.slice(1)
    const params = new URLSearchParams(hash)
    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type         = params.get('type')

    if (accessToken && type === 'recovery') {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken ?? '' })
        .then(({ error }) => {
          if (error) {
            setError('Invalid or expired reset link. Please request a new one.')
          } else {
            setReady(true)
            // Clean the hash from URL
            window.history.replaceState(null, '', window.location.pathname)
          }
        })
      return
    }

    // Fallback: already has session (e.g. came from PKCE callback)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true)
      } else if (!accessToken) {
        setError('Invalid reset link. Please request a new password reset.')
      }
    })

    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    if (password.length < 8)  { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password updated!')
      window.location.href = '/dashboard'
    }
  }

  if (error) {
    return (
      <Card className="w-full max-w-md bg-slate-900 border-slate-800">
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-red-400 text-sm">{error}</p>
          <Button
            onClick={() => window.location.href = '/forgot-password'}
            className="bg-violet-600 hover:bg-violet-500 text-white"
          >
            Request new reset link
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!ready) {
    return (
      <Card className="w-full max-w-md bg-slate-900 border-slate-800">
        <CardContent className="py-12 text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Verifying reset link…</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md bg-slate-900 border-slate-800">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-white">Set new password</CardTitle>
        <CardDescription className="text-slate-400">Choose a strong password for your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">New password</Label>
            <Input
              id="password" type="password" placeholder="••••••••"
              required minLength={8}
              value={password} onChange={e => setPassword(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-slate-300">Confirm password</Label>
            <Input
              id="confirm" type="password" placeholder="••••••••"
              required
              value={confirm} onChange={e => setConfirm(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          {password && (
            <div className="space-y-1">
              {[
                { label: '8+ characters',   ok: password.length >= 8 },
                { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
                { label: 'Number',           ok: /\d/.test(password) },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2 text-xs">
                  <span className={r.ok ? 'text-emerald-400' : 'text-slate-600'}>{r.ok ? '✓' : '○'}</span>
                  <span className={r.ok ? 'text-emerald-400' : 'text-slate-500'}>{r.label}</span>
                </div>
              ))}
            </div>
          )}

          <Button
            type="submit" disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white"
          >
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
