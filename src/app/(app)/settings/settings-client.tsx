'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Business {
  id: string
  name: string
  industry: string
  website_url: string | null
  description: string | null
  country: string
  size: string
  target_customer: string
}

interface Profile {
  name: string | null
  language: string | null
  timezone: string | null
}

interface Workspace {
  name: string | null
  plan: string | null
}

interface Props {
  profile: Profile
  business: Business | null
  workspace: Workspace | null
  workspaceId: string | null
  email: string
}

export default function SettingsClient({ profile, business, workspace, workspaceId, email }: Props) {
  // Profile state
  const [name, setName] = useState(profile.name || '')
  const [language, setLanguage] = useState(profile.language || 'en')
  const [timezone, setTimezone] = useState(profile.timezone || 'UTC')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Email change state
  const [showEmailChange, setShowEmailChange] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingEmail, setSavingEmail] = useState(false)

  async function changeEmail() {
    if (!newEmail || !emailPassword) return
    setSavingEmail(true)
    setEmailMsg(null)
    const supabase = createClient()
    // Re-authenticate first to confirm identity
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: emailPassword })
    if (authErr) {
      setSavingEmail(false)
      setEmailMsg({ ok: false, text: 'Current password is incorrect.' })
      return
    }
    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/settings&type=email_change` }
    )
    setSavingEmail(false)
    if (error) {
      setEmailMsg({ ok: false, text: error.message })
    } else {
      setEmailMsg({ ok: true, text: `Confirmation sent to ${newEmail}. Click the link in that email to confirm the change.` })
      setNewEmail('')
      setEmailPassword('')
    }
  }

  // Business state
  const [bizName, setBizName] = useState(business?.name || '')
  const [industry, setIndustry] = useState(business?.industry || '')
  const [website, setWebsite] = useState(business?.website_url || '')
  const [description, setDescription] = useState(business?.description || '')
  const [country, setCountry] = useState(business?.country || 'United States')
  const [size, setSize] = useState(business?.size || '2-10')
  const [target, setTarget] = useState(business?.target_customer || 'b2b')
  const [savingBiz, setSavingBiz] = useState(false)
  const [bizSaved, setBizSaved] = useState(false)
  const [bizError, setBizError] = useState('')

  // Delete business state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const router = useRouter()

  async function deleteBusiness() {
    if (!workspaceId || !business) return
    setDeleting(true)
    setDeleteError('')
    const res = await fetch('/api/workspaces/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, confirm_name: deleteConfirmName }),
    })
    const data = await res.json()
    setDeleting(false)
    if (!res.ok) {
      setDeleteError(data.error || 'Failed to delete')
      return
    }
    // Redirect to dashboard (will land on next workspace or onboarding)
    router.push('/dashboard')
    router.refresh()
  }

  async function saveProfile() {
    setSavingProfile(true)
    await fetch('/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, language, timezone }),
    })
    setSavingProfile(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2500)
  }

  async function saveBusiness() {
    setSavingBiz(true)
    setBizError('')
    const res = await fetch('/api/settings/business', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: bizName, industry, website_url: website, description, country, size, target_customer: target }),
    })
    const data = await res.json()
    setSavingBiz(false)
    if (data.ok) {
      setBizSaved(true)
      setTimeout(() => setBizSaved(false), 2500)
    } else {
      setBizError(data.error || 'Failed to save')
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Manage your account and workspace</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Profile</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <div className="flex gap-2">
                  <input type="email" value={email} readOnly
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-400 text-sm cursor-not-allowed min-w-0" />
                  <button
                    onClick={() => { setShowEmailChange(!showEmailChange); setEmailMsg(null) }}
                    className="flex-shrink-0 px-3 py-2 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                  >
                    Change
                  </button>
                </div>

                {showEmailChange && (
                  <div className="mt-3 p-4 bg-slate-800 border border-slate-700 rounded-xl space-y-3">
                    <p className="text-xs text-slate-400 font-medium">Change Email Address</p>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">New email</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        placeholder="new@email.com"
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Current password (to confirm)</label>
                      <input
                        type="password"
                        value={emailPassword}
                        onChange={e => setEmailPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                      />
                    </div>
                    {emailMsg && (
                      <p className={`text-xs leading-relaxed ${emailMsg.ok ? 'text-blue-400' : 'text-red-400'}`}>
                        {emailMsg.ok ? '✓ ' : '✗ '}{emailMsg.text}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={changeEmail}
                        disabled={savingEmail || !newEmail || !emailPassword}
                        className="flex-1 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        {savingEmail ? 'Sending…' : 'Send confirmation'}
                      </button>
                      <button
                        onClick={() => { setShowEmailChange(false); setEmailMsg(null) }}
                        className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none">
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="pt">Portuguese</option>
                  <option value="bn">Bengali</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Timezone</label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none">
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Dubai">Dubai</option>
                  <option value="Asia/Dhaka">Dhaka</option>
                  <option value="Asia/Singapore">Singapore</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                  <option value="Australia/Sydney">Sydney</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {savingProfile ? 'Saving…' : 'Save Profile'}
              </button>
              {profileSaved && <span className="text-blue-400 text-sm">✓ Saved</span>}
            </div>
          </div>
        </div>

        {/* Business */}
        {business && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Business Profile</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Business Name</label>
                  <input type="text" value={bizName} onChange={e => setBizName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Industry</label>
                  <input type="text" value={industry} onChange={e => setIndustry(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Country</label>
                  <input type="text" value={country} onChange={e => setCountry(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Team Size</label>
                  <select value={size} onChange={e => setSize(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none">
                    <option value="1">Just me</option>
                    <option value="2-10">2–10</option>
                    <option value="11-50">11–50</option>
                    <option value="51-200">51–200</option>
                    <option value="201-500">201–500</option>
                    <option value="500+">500+</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Website URL</label>
                <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                  placeholder="https://yourbusiness.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Who are your customers?</label>
                <div className="flex gap-2">
                  {(['b2b', 'b2c', 'both'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setTarget(t)}
                      className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        target === t ? 'bg-slate-950/50 border-blue-500 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}>
                      {t === 'b2b' ? 'Businesses (B2B)' : t === 'b2c' ? 'Consumers (B2C)' : 'Both'}
                    </button>
                  ))}
                </div>
              </div>
              {bizError && <p className="text-red-400 text-sm">{bizError}</p>}
              <div className="flex items-center gap-3">
                <button
                  onClick={saveBusiness}
                  disabled={savingBiz}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {savingBiz ? 'Saving…' : 'Save Business'}
                </button>
                {bizSaved && <span className="text-blue-400 text-sm">✓ Saved</span>}
              </div>
            </div>
          </div>
        )}

        {/* Workspace */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Workspace</h2>
          <div className="space-y-1">
            <div className="flex items-center justify-between py-2.5 border-b border-slate-800">
              <div>
                <p className="text-white text-sm">{workspace?.name}</p>
                <p className="text-slate-500 text-xs">Plan: {workspace?.plan || 'Starter'}</p>
              </div>
              <Link href="/pricing" className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                Upgrade →
              </Link>
            </div>
            {[
              { href: '/settings/billing', label: 'Billing & Plan', desc: 'View current plan, upgrade, manage payment method' },
              { href: '/settings/integrations', label: 'Integrations', desc: 'Website embed, CRM, analytics tools' },
              { href: '/settings/team', label: 'Team Members', desc: 'Manage access and roles' },
              { href: '/settings/notifications', label: 'Notifications', desc: 'Email, Slack, and push alert preferences' },
              { href: '/settings/agent', label: 'Agent Settings', desc: 'Configure what the AI agent does automatically' },
              { href: '/settings/white-label', label: 'White-Label & Portal', desc: 'Brand the client portal with your logo, colors, and domain' },
              { href: '/settings/scoring',     label: 'Lead Scoring Rules',   desc: 'Define rules that auto-adjust lead scores based on attributes' },
            ].map(item => (
              <Link key={item.href} href={item.href} className="flex items-center justify-between py-2.5 hover:text-white transition-colors group">
                <div>
                  <p className="text-slate-300 group-hover:text-white text-sm">{item.label}</p>
                  <p className="text-slate-600 text-xs">{item.desc}</p>
                </div>
                <span className="text-slate-600 group-hover:text-slate-400">→</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-slate-900 border border-red-900/30 rounded-2xl p-6">
          <h2 className="text-red-400 font-semibold mb-4">Danger Zone</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm">Sign out of CooVex</p>
                <p className="text-slate-600 text-xs">You can sign back in at any time</p>
              </div>
              <form action="/api/auth/signout" method="post">
                <button type="submit" className="bg-red-950/40 hover:bg-red-900/40 border border-red-900/40 text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  Sign Out
                </button>
              </form>
            </div>

            {business && workspaceId && (
              <div className="flex items-center justify-between pt-4 border-t border-red-900/20">
                <div>
                  <p className="text-slate-300 text-sm">Delete Business</p>
                  <p className="text-slate-600 text-xs">Permanently delete <span className="text-slate-500">{business.name}</span> and all its data. This cannot be undone.</p>
                </div>
                <button
                  onClick={() => { setShowDeleteModal(true); setDeleteConfirmName(''); setDeleteError('') }}
                  className="bg-red-950/40 hover:bg-red-900/40 border border-red-900/40 text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Delete Business
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && business && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-red-900/40 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-950/60 border border-red-800/50 flex items-center justify-center flex-shrink-0 text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="text-white font-semibold text-base">Delete Business?</h3>
                <p className="text-slate-400 text-sm mt-1">
                  This will permanently delete <span className="text-white font-medium">{business.name}</span> and all associated data — leads, campaigns, competitors, content, reviews, and AI memory. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4 mb-5">
              <p className="text-red-400 text-xs font-semibold mb-3">What will be deleted:</p>
              <ul className="text-slate-400 text-xs space-y-1">
                {['All leads and pipeline data', 'Campaigns and drip sequences', 'Competitor tracking', 'Content calendar and posts', 'Reviews and responses', 'Website audit history', 'AI agent memory', 'All credits and billing history'].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="text-red-500">✕</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Type <span className="text-white font-semibold">{business.name}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={e => setDeleteConfirmName(e.target.value)}
                placeholder={business.name}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 transition-colors placeholder:text-slate-600"
                autoFocus
              />
            </div>

            {deleteError && (
              <p className="text-red-400 text-sm mb-4">✗ {deleteError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmName(''); setDeleteError('') }}
                className="flex-1 py-2.5 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteBusiness}
                disabled={deleteConfirmName.trim().toLowerCase() !== business.name.trim().toLowerCase() || deleting}
                className="flex-1 py-2.5 text-sm font-semibold bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
