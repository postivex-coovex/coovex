'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface SocialPage {
  id: string
  name: string
  access_token?: string
}

interface SocialConnection {
  connected: boolean
  account_name?: string
  pages?: SocialPage[]
  selected_page_id?: string | null
}

interface SocialSectionProps {
  connections: Record<string, SocialConnection>
  linkedinConfigured: boolean
  facebookConfigured: boolean
}

const CHANNELS = [
  {
    key: 'linkedin',
    icon: '💼',
    name: 'LinkedIn',
    desc: 'Publish posts to your LinkedIn profile or company page',
    authPath: '/api/auth/linkedin',
    configKey: 'linkedin',
    personalLabel: 'Personal Profile',
  },
  {
    key: 'facebook',
    icon: '📘',
    name: 'Facebook',
    desc: 'Auto-publish to your Facebook Page (requires Page admin access)',
    authPath: '/api/auth/facebook',
    configKey: 'facebook',
    personalLabel: null, // Facebook always posts as a page
  },
  {
    key: 'instagram',
    icon: '📸',
    name: 'Instagram',
    desc: 'Publish to Instagram Business account — connects automatically when you connect Facebook',
    authPath: '/api/auth/facebook',
    configKey: 'facebook',
    personalLabel: null,
  },
  {
    key: 'tiktok',
    icon: '🎵',
    name: 'TikTok',
    desc: 'Publish short-form video posts to TikTok via TikTok for Developers',
    authPath: '/api/auth/tiktok',
    configKey: 'tiktok',
    personalLabel: null,
  },
]

function PageSelector({
  platform,
  connection,
  personalLabel,
  onChanged,
}: {
  platform: string
  connection: SocialConnection
  personalLabel: string | null
  onChanged: (pageId: string | null) => void
}) {
  const [saving, setSaving] = useState(false)
  const pages = connection.pages ?? []
  const selectedId = connection.selected_page_id ?? null

  // For Facebook: always has pages, no personal option
  // For LinkedIn: can post as personal OR company page
  const hasPages = pages.length > 0

  if (!hasPages && !personalLabel) return null
  if (!hasPages && personalLabel) {
    // No company pages found — show info
    return (
      <p className="text-slate-600 text-xs mt-1.5 italic">
        No company pages found. Posting as personal profile.
        {platform === 'linkedin' && (
          <span> (Requires Marketing Developer Platform on your LinkedIn app)</span>
        )}
      </p>
    )
  }

  async function select(pageId: string | null) {
    setSaving(true)
    try {
      await fetch('/api/social/select-page', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, page_id: pageId }),
      })
      onChanged(pageId)
    } finally {
      setSaving(false)
    }
  }

  const options: { id: string | null; label: string }[] = []
  if (personalLabel) {
    options.push({ id: null, label: `👤 ${personalLabel} (${connection.account_name ?? ''})` })
  }
  pages.forEach(p => options.push({ id: p.id, label: `🏢 ${p.name}` }))

  const currentLabel = options.find(o => o.id === selectedId)?.label
    ?? options[0]?.label
    ?? 'Select…'

  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-slate-500 text-xs flex-shrink-0">Post as:</span>
      <div className="relative flex-1 max-w-xs">
        <select
          value={selectedId ?? ''}
          onChange={e => select(e.target.value === '' ? null : e.target.value)}
          disabled={saving}
          className="w-full appearance-none bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg pl-3 pr-8 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500 transition-colors cursor-pointer disabled:opacity-60"
        >
          {options.map(o => (
            <option key={String(o.id)} value={o.id ?? ''}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">
          {saving ? '…' : '▾'}
        </span>
      </div>
      {saving && <span className="text-slate-500 text-xs">Saving…</span>}
    </div>
  )
}

export default function SocialSection({ connections: initial, linkedinConfigured, facebookConfigured }: SocialSectionProps) {
  const [connections, setConnections] = useState(initial)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (connected) {
      const names = connected.split(',').map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(' & ')
      setToast({ type: 'success', msg: `${names} connected successfully!` })
    } else if (error) {
      const msgs: Record<string, string> = {
        not_configured:  'Platform not configured — add API keys first',
        linkedin_denied: 'LinkedIn authorization was cancelled',
        facebook_denied: 'Facebook authorization was cancelled',
        linkedin_token:  'Failed to get LinkedIn access token',
        facebook_token:  'Failed to get Facebook access token',
        invalid_state:   'Security check failed — please try again',
        no_business:     'No business found — complete onboarding first',
      }
      setToast({ type: 'error', msg: msgs[error] ?? `Connection failed: ${error}` })
    }
  }, [searchParams])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const isConfigured = (key: string) => {
    if (key === 'linkedin') return linkedinConfigured
    if (key === 'facebook' || key === 'instagram') return facebookConfigured
    return true
  }

  const disconnect = async (platform: string) => {
    setDisconnecting(platform)
    try {
      const res = await fetch('/api/social/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      if (res.ok) {
        setConnections(prev => { const next = { ...prev }; delete next[platform]; return next })
        setToast({ type: 'success', msg: `${platform.charAt(0).toUpperCase() + platform.slice(1)} disconnected` })
      }
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <div id="social" className="space-y-3">
      {toast && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
          toast.type === 'success'
            ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
            : 'bg-red-950/30 border-red-800/40 text-red-300'
        }`}>
          <span>{toast.type === 'success' ? '✓' : '✗'}</span>
          {toast.msg}
        </div>
      )}

      {CHANNELS.map(ch => {
        const conn = connections[ch.key]
        const isConnected = conn?.connected === true
        const configured = isConfigured(ch.configKey)
        const isInstagram = ch.key === 'instagram'
        const fbConnected = connections['facebook']?.connected === true

        // Determine what's being shown as "posting as"
        const postingAs = (() => {
          if (!isConnected || !conn) return null
          const pages = conn.pages ?? []
          const selId = conn.selected_page_id ?? null
          if (ch.key === 'linkedin') {
            if (selId) return pages.find(p => p.id === selId)?.name ?? null
            return conn.account_name ?? 'Personal Profile'
          }
          if (ch.key === 'facebook') {
            if (selId) return pages.find(p => p.id === selId)?.name ?? pages[0]?.name ?? null
            return pages[0]?.name ?? null
          }
          return null
        })()

        return (
          <div key={ch.key} className={`bg-slate-900 border rounded-2xl p-5 transition-colors ${
            isConnected ? 'border-emerald-800/30' : 'border-slate-800'
          }`}>
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                isConnected ? 'bg-emerald-950/40 border border-emerald-800/40' : 'bg-slate-800'
              }`}>
                {ch.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-white font-medium">{ch.name}</h3>
                  {isConnected ? (
                    <span className="text-xs px-2 py-0.5 bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 rounded-full">
                      Connected
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-500 border border-slate-700 rounded-full">
                      Not connected
                    </span>
                  )}
                </div>

                {isConnected && conn ? (
                  <>
                    <p className="text-slate-500 text-sm">
                      {conn.account_name ? `@${conn.account_name}` : ch.desc}
                      {postingAs && (
                        <span className="text-slate-600"> · posting as <span className="text-slate-400">{postingAs}</span></span>
                      )}
                    </p>

                    {/* Page selector — Facebook only (LinkedIn company API requires special approval) */}
                    {ch.key === 'facebook' && (
                      <PageSelector
                        platform={ch.key}
                        connection={conn}
                        personalLabel={ch.personalLabel}
                        onChanged={pageId =>
                          setConnections(prev => ({
                            ...prev,
                            [ch.key]: { ...prev[ch.key], selected_page_id: pageId },
                          }))
                        }
                      />
                    )}
                    {ch.key === 'linkedin' && (
                      <p className="text-slate-600 text-xs mt-1.5">
                        Posting as personal profile ·{' '}
                        <span className="text-slate-500">Company page posting — coming soon</span>
                      </p>
                    )}

                    {/* Instagram: shows which page it's linked to */}
                    {ch.key === 'instagram' && conn.account_name && (
                      <p className="text-slate-600 text-xs mt-1">
                        Business account via Facebook page
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-slate-500 text-sm">
                    {isInstagram && !fbConnected
                      ? 'Connect Facebook first — Instagram links automatically'
                      : ch.desc}
                  </p>
                )}
              </div>

              {/* Action button */}
              <div className="flex-shrink-0 self-start">
                {isConnected ? (
                  <button
                    onClick={() => disconnect(ch.key)}
                    disabled={disconnecting === ch.key}
                    className="text-sm px-4 py-2 bg-slate-800 hover:bg-red-950/30 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-800/40 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {disconnecting === ch.key ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                ) : isInstagram ? (
                  <span className="text-xs text-slate-600 italic">
                    {fbConnected ? 'Auto-linked via Facebook' : 'Via Facebook →'}
                  </span>
                ) : !configured ? (
                  <div className="text-right">
                    <button disabled
                      className="text-sm px-4 py-2 bg-slate-800 text-slate-600 border border-slate-700 rounded-lg cursor-not-allowed">
                      Connect
                    </button>
                    <p className="text-[10px] text-amber-600 mt-1">API keys not set</p>
                  </div>
                ) : (
                  <a href={ch.authPath}
                    className="inline-block text-sm px-4 py-2 bg-violet-700 hover:bg-violet-600 text-white rounded-lg transition-colors font-medium">
                    Connect
                  </a>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Setup instructions */}
      {(!linkedinConfigured || !facebookConfigured) && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-sm text-slate-500">
          <p className="font-medium text-slate-400 mb-2">Setup required — add to <code className="text-violet-400">.env.local</code>:</p>
          <div className="font-mono text-xs space-y-1 text-slate-500">
            {!linkedinConfigured && (
              <>
                <p className="text-slate-600"># LinkedIn Developer App → Auth → OAuth 2.0 settings</p>
                <p>LINKEDIN_CLIENT_ID=<span className="text-amber-500">your_client_id</span></p>
                <p>LINKEDIN_CLIENT_SECRET=<span className="text-amber-500">your_client_secret</span></p>
                <p className="text-slate-600 mt-1"># For company page posting: enable &quot;Marketing Developer Platform&quot; product</p>
              </>
            )}
            {!facebookConfigured && (
              <>
                <p className="text-slate-600 mt-2"># Meta for Developers → Your App → Settings → Basic</p>
                <p>FACEBOOK_APP_ID=<span className="text-amber-500">your_app_id</span></p>
                <p>FACEBOOK_APP_SECRET=<span className="text-amber-500">your_app_secret</span></p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
