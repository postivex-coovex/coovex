'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const ROLES = [
  'Business Owner / Founder',
  'CEO / C-Level Executive',
  'Marketing Manager',
  'Sales Manager',
  'Product Manager',
  'Operations Manager',
  'Consultant / Freelancer',
  'Developer / Engineer',
  'Agency Owner',
  'Other',
]

const REFERRAL_SOURCES = [
  'Google Search',
  'LinkedIn',
  'Facebook / Instagram',
  'Friend or Colleague',
  'Blog or Article',
  'YouTube',
  'Product Hunt',
  'Email / Newsletter',
  'Other',
]

export function SignupForm() {
  const [name, setName]                   = useState('')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [role, setRole]                   = useState('')
  const [referralSource, setReferralSource] = useState('')
  const [loading, setLoading]             = useState(false)
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  useEffect(() => {
    const prefill = searchParams.get('email')
    if (prefill) setEmail(prefill)
  }, [searchParams])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (!role) { toast.error('Please select your role'); return }
    if (!referralSource) { toast.error('Please tell us how you found us'); return }
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role, referral_source: referralSource },
        },
      })

      if (error) {
        toast.error(error.message)
        return
      }

      // Update profile with role + referral_source (non-blocking)
      if (data.user) {
        supabase
          .from('profiles')
          .update({ role, referral_source: referralSource })
          .eq('id', data.user.id)
          .then(() => {})
      }

      if (!data.session) {
        window.location.href = '/verify-email'
      } else {
        window.location.href = '/dashboard'
      }
    } catch (err) {
      toast.error('Something went wrong. Please try again.')
      console.error('Signup error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignup() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard` },
    })
  }

  const inputCls = "w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-violet-500 focus:outline-none text-slate-900 text-sm placeholder:text-slate-400 transition-colors bg-slate-50 focus:bg-white"
  const selectCls = `${inputCls} appearance-none cursor-pointer`

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/80 border border-slate-100 p-8">

        {/* Heading */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-1.5">Start your free trial</h1>
          <p className="text-slate-500 text-sm">14 days free · Full access · Cancel anytime</p>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogleSignup}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-700 font-semibold text-sm mb-5"
        >
          <svg className="w-4.5 h-4.5 flex-shrink-0" viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="relative flex items-center mb-5">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="px-3 text-slate-400 text-xs font-medium">or with email</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className="space-y-4">

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1.5">Full name</label>
            <input
              id="name" type="text" placeholder="Jane Smith"
              value={name} onChange={e => setName(e.target.value)} required
              className={inputCls}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">Work email</label>
            <input
              id="email" type="email" placeholder="jane@company.com"
              value={email} onChange={e => setEmail(e.target.value)} required
              className={inputCls}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <input
              id="password" type="password" placeholder="Min. 8 characters"
              value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
              className={inputCls}
            />
          </div>

          {/* Divider */}
          <div className="pt-1 pb-0.5">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Tell us about yourself</p>
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Your role <span className="text-violet-500">*</span>
            </label>
            <div className="relative">
              <select
                id="role"
                value={role}
                onChange={e => setRole(e.target.value)}
                required
                className={`${selectCls} pr-10 ${!role ? 'text-slate-400' : 'text-slate-900'}`}
              >
                <option value="" disabled>Select your role…</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Referral source */}
          <div>
            <label htmlFor="referral" className="block text-xs font-semibold text-slate-700 mb-1.5">
              How did you find us? <span className="text-violet-500">*</span>
            </label>
            <div className="relative">
              <select
                id="referral"
                value={referralSource}
                onChange={e => setReferralSource(e.target.value)}
                required
                className={`${selectCls} pr-10 ${!referralSource ? 'text-slate-400' : 'text-slate-900'}`}
              >
                <option value="" disabled>Select a source…</option>
                {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            {loading ? 'Creating account…' : 'Create free account →'}
          </button>
        </form>

        {/* Terms */}
        <p className="text-center text-xs text-slate-400 mt-4">
          By signing up, you agree to our{' '}
          <Link href="/terms" className="text-violet-600 hover:underline">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" className="text-violet-600 hover:underline">Privacy Policy</Link>.
        </p>

        <p className="text-center text-sm text-slate-500 mt-3">
          Already have an account?{' '}
          <Link href="/login" className="text-violet-600 hover:text-violet-700 font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
