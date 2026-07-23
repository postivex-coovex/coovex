'use client'

import { useState } from 'react'

interface NotifGroup {
  label: string
  desc: string
  items: { key: string; label: string; desc: string }[]
}

const NOTIF_GROUPS: NotifGroup[] = [
  {
    label: 'Agent Alerts',
    desc: 'Signals from your AI business agent',
    items: [
      { key: 'agent_urgent', label: 'Urgent signals', desc: 'Critical issues requiring immediate action' },
      { key: 'agent_opportunity', label: 'Opportunities', desc: 'New leads, trends, or growth signals' },
      { key: 'agent_daily_brief', label: 'Daily brief (6am)', desc: 'Morning summary of your top 3 priorities' },
      { key: 'agent_weekly_report', label: 'Weekly report', desc: 'Business health score and week-in-review' },
    ],
  },
  {
    label: 'Reviews',
    desc: 'Review platform notifications',
    items: [
      { key: 'review_new', label: 'New review received', desc: 'Alert when a new review arrives on any platform' },
      { key: 'review_negative', label: 'Negative review (≤3★)', desc: 'Immediate alert for 1-3 star reviews' },
      { key: 'review_spike', label: 'Review volume spike', desc: '5+ reviews in 24 hours (unusual activity)' },
    ],
  },
  {
    label: 'Leads',
    desc: 'Lead management notifications',
    items: [
      { key: 'lead_new', label: 'New lead captured', desc: 'Lead arrives from any source' },
      { key: 'lead_hot', label: 'Hot lead (score ≥ 80)', desc: 'High-intent lead detected' },
      { key: 'lead_cold', label: 'Cold lead alert (30 days inactive)', desc: 'Re-engagement reminders' },
    ],
  },
  {
    label: 'Content',
    desc: 'Content and publishing notifications',
    items: [
      { key: 'post_scheduled', label: 'Post scheduled for today', desc: 'Morning reminder of posts going out today' },
      { key: 'post_published', label: 'Post published successfully', desc: 'Confirmation when auto-publish succeeds' },
      { key: 'post_failed', label: 'Post publish failed', desc: 'Alert if a scheduled post fails to publish' },
    ],
  },
  {
    label: 'Competitors',
    desc: 'Competitor monitoring alerts',
    items: [
      { key: 'competitor_new_content', label: 'Competitor posts new content', desc: 'Be first to know when they publish' },
      { key: 'competitor_review_spike', label: 'Competitor review activity', desc: 'When a competitor gets unusually high or low reviews' },
    ],
  },
]

const DEFAULT_ON = ['agent_urgent', 'review_negative', 'lead_hot', 'post_failed', 'agent_daily_brief']

interface NotificationsClientProps {
  userId: string
  initialPrefs: Record<string, boolean>
}

export default function NotificationsClient({ userId, initialPrefs }: NotificationsClientProps) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    // Load from localStorage first, fall back to server-side prefs, then defaults
    let stored: Record<string, boolean> = {}
    if (typeof window !== 'undefined') {
      try { stored = JSON.parse(localStorage.getItem('notif_prefs') || '{}') } catch {}
    }
    const p: Record<string, boolean> = {}
    NOTIF_GROUPS.forEach(g => g.items.forEach(item => {
      p[item.key] = item.key in stored ? stored[item.key]
        : item.key in initialPrefs ? initialPrefs[item.key]
        : DEFAULT_ON.includes(item.key)
    }))
    return p
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const toggle = (key: string) => setPrefs(prev => ({ ...prev, [key]: !prev[key] }))

  const save = async () => {
    setSaving(true)
    try {
      // Persist in localStorage (server persistence requires schema migration)
      localStorage.setItem('notif_prefs', JSON.stringify(prefs))
      await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences_json: prefs }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {NOTIF_GROUPS.map(group => (
        <div key={group.label} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold">{group.label}</h2>
            <p className="text-slate-500 text-xs mt-0.5">{group.desc}</p>
          </div>
          <div className="divide-y divide-slate-800/50">
            {group.items.map(item => (
              <div key={item.key} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-slate-200 text-sm">{item.label}</p>
                  <p className="text-slate-500 text-xs">{item.desc}</p>
                </div>
                <button
                  onClick={() => toggle(item.key)}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                    prefs[item.key] ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                      prefs[item.key] ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Delivery channels */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-3">Delivery Channels</h2>
        <div className="space-y-3">
          {[
            { label: 'Email', desc: 'Requires Resend setup (coming soon)', available: false },
            { label: 'In-app (Agent Inbox)', desc: 'Signals appear in your dashboard', available: true },
            { label: 'Slack', desc: 'Requires Slack integration', available: false },
          ].map(ch => (
            <div key={ch.label} className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm">{ch.label}</p>
                <p className="text-slate-500 text-xs">{ch.desc}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                ch.available ? 'bg-slate-950/60 text-blue-400 border border-slate-700/40' : 'bg-slate-800 text-slate-500'
              }`}>
                {ch.available ? 'Active' : 'Coming soon'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
        {saved && <span className="text-blue-400 text-sm">✓ Saved</span>}
      </div>
    </div>
  )
}
