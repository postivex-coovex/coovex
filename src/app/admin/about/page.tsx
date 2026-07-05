'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Stat      = { label: string; value: string }
type Value     = { icon: string; title: string; description: string }
type Member    = { name: string; role: string; bio: string; avatar: string }
type Milestone = { year: string; event: string }

type AboutData = {
  hero: { badge: string; title: string; subtitle: string }
  story: string
  mission: string
  vision: string
  stats: Stat[]
  values: Value[]
  team: Member[]
  milestones: Milestone[]
}

const DEFAULT: AboutData = {
  hero:       { badge: '', title: '', subtitle: '' },
  story:      '',
  mission:    '',
  vision:     '',
  stats:      [],
  values:     [],
  team:       [],
  milestones: [],
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-white font-semibold text-base">{title}</h2>
      {desc && <span className="text-slate-600 text-xs">{desc}</span>}
      <div className="flex-1 h-px bg-slate-800" />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-slate-400 text-xs mb-1">{label}</label>
      {children}
    </div>
  )
}

const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-600'
const ta  = inp + ' resize-none'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAboutPage() {
  const [data, setData]     = useState<AboutData>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [tab, setTab]         = useState<'hero' | 'stats' | 'values' | 'team' | 'milestones'>('hero')

  const fetch_ = useCallback(async () => {
    const res = await fetch('/api/admin/about')
    if (res.ok) {
      const json = await res.json()
      if (json && Object.keys(json).length > 0) setData({ ...DEFAULT, ...json })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  const save = async () => {
    setSaving(true)
    await fetch('/api/admin/about', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // ── setters ────────────────────────────────────────────────────────────────

  const setHero = (k: keyof AboutData['hero'], v: string) =>
    setData(d => ({ ...d, hero: { ...d.hero, [k]: v } }))

  const setStat = (i: number, k: keyof Stat, v: string) =>
    setData(d => { const a = [...d.stats]; a[i] = { ...a[i], [k]: v }; return { ...d, stats: a } })
  const addStat = () =>
    setData(d => ({ ...d, stats: [...d.stats, { label: '', value: '' }] }))
  const removeStat = (i: number) =>
    setData(d => ({ ...d, stats: d.stats.filter((_, idx) => idx !== i) }))

  const setVal = (i: number, k: keyof Value, v: string) =>
    setData(d => { const a = [...d.values]; a[i] = { ...a[i], [k]: v }; return { ...d, values: a } })
  const addVal = () =>
    setData(d => ({ ...d, values: [...d.values, { icon: '⭐', title: '', description: '' }] }))
  const removeVal = (i: number) =>
    setData(d => ({ ...d, values: d.values.filter((_, idx) => idx !== i) }))

  const setMember = (i: number, k: keyof Member, v: string) =>
    setData(d => { const a = [...d.team]; a[i] = { ...a[i], [k]: v }; return { ...d, team: a } })
  const addMember = () =>
    setData(d => ({ ...d, team: [...d.team, { name: '', role: '', bio: '', avatar: '' }] }))
  const removeMember = (i: number) =>
    setData(d => ({ ...d, team: d.team.filter((_, idx) => idx !== i) }))

  const setMs = (i: number, k: keyof Milestone, v: string) =>
    setData(d => { const a = [...d.milestones]; a[i] = { ...a[i], [k]: v }; return { ...d, milestones: a } })
  const addMs = () =>
    setData(d => ({ ...d, milestones: [...d.milestones, { year: '', event: '' }] }))
  const removeMs = (i: number) =>
    setData(d => ({ ...d, milestones: d.milestones.filter((_, idx) => idx !== i) }))

  // ──────────────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-6 text-slate-500 text-sm">Loading…</div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">About Page</h1>
          <p className="text-slate-400 text-sm mt-0.5">Edit all sections of the public About page</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/about" target="_blank" className="text-slate-400 hover:text-white text-sm border border-slate-700 px-3 py-2 rounded-lg transition-colors">
            Preview →
          </Link>
          <button
            onClick={save}
            disabled={saving}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 border border-slate-800 rounded-xl p-1">
        {([
          { key: 'hero',       label: '🏠 Hero & Story' },
          { key: 'stats',      label: '📊 Stats' },
          { key: 'values',     label: '⭐ Values' },
          { key: 'team',       label: '👥 Team' },
          { key: 'milestones', label: '📅 Milestones' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-xs py-2 rounded-lg transition-colors ${tab === t.key ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Hero & Story ─────────────────────────────────────────────────── */}
      {tab === 'hero' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <SectionHeader title="Hero Section" />
            <Field label="Badge text (small label above title)">
              <input value={data.hero.badge} onChange={e => setHero('badge', e.target.value)} placeholder="Our Mission" className={inp} />
            </Field>
            <Field label="Main Title">
              <input value={data.hero.title} onChange={e => setHero('title', e.target.value)} placeholder="Building the future of AI business intelligence" className={inp} />
            </Field>
            <Field label="Subtitle">
              <textarea value={data.hero.subtitle} onChange={e => setHero('subtitle', e.target.value)} rows={3} placeholder="We believe every business deserves…" className={ta} />
            </Field>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <SectionHeader title="Company Story" />
            <Field label="Origin story (1–3 paragraphs)">
              <textarea value={data.story} onChange={e => setData(d => ({ ...d, story: e.target.value }))} rows={5} placeholder="CooVex was founded in 2024 after…" className={ta} />
            </Field>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <SectionHeader title="Mission & Vision" />
            <Field label="Mission (one sentence)">
              <input value={data.mission} onChange={e => setData(d => ({ ...d, mission: e.target.value }))} placeholder="To make AI-powered business intelligence accessible to every entrepreneur." className={inp} />
            </Field>
            <Field label="Vision (one sentence)">
              <input value={data.vision} onChange={e => setData(d => ({ ...d, vision: e.target.value }))} placeholder="A world where no business owner wakes up to surprises." className={inp} />
            </Field>
          </div>
        </div>
      )}

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      {tab === 'stats' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Stats / Numbers" desc="Shown as impact numbers on the About page" />
            <button onClick={addStat} className="text-xs text-violet-400 border border-violet-800/50 px-3 py-1 rounded-lg hover:bg-violet-900/20 flex-shrink-0">
              + Add Stat
            </button>
          </div>
          <div className="space-y-3">
            {data.stats.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center">
                <input value={s.value} onChange={e => setStat(i, 'value', e.target.value)} placeholder="2,400+" className={inp} />
                <input value={s.label} onChange={e => setStat(i, 'label', e.target.value)} placeholder="Businesses monitored" className={inp} />
                <button onClick={() => removeStat(i)} className="text-red-500 hover:text-red-400 px-2 py-2">✕</button>
              </div>
            ))}
            {data.stats.length === 0 && (
              <button onClick={addStat} className="w-full border border-dashed border-slate-700 text-slate-500 hover:text-violet-400 hover:border-violet-700 rounded-xl py-4 text-sm transition-colors">
                + Add your first stat
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Values ───────────────────────────────────────────────────────── */}
      {tab === 'values' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Company Values" />
            <button onClick={addVal} className="text-xs text-violet-400 border border-violet-800/50 px-3 py-1 rounded-lg hover:bg-violet-900/20 flex-shrink-0">
              + Add Value
            </button>
          </div>
          <div className="space-y-4">
            {data.values.map((v, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <input value={v.icon} onChange={e => setVal(i, 'icon', e.target.value)} className="w-12 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-center text-base focus:outline-none" placeholder="⭐" />
                  <input value={v.title} onChange={e => setVal(i, 'title', e.target.value)} placeholder="Value title" className={`flex-1 ${inp}`} />
                  <button onClick={() => removeVal(i)} className="text-red-500 hover:text-red-400 px-2">✕</button>
                </div>
                <textarea value={v.description} onChange={e => setVal(i, 'description', e.target.value)} rows={2} placeholder="Describe this value…" className={ta} />
              </div>
            ))}
            {data.values.length === 0 && (
              <button onClick={addVal} className="w-full border border-dashed border-slate-700 text-slate-500 hover:text-violet-400 hover:border-violet-700 rounded-xl py-4 text-sm transition-colors">
                + Add first value
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Team ─────────────────────────────────────────────────────────── */}
      {tab === 'team' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Team Members" />
            <button onClick={addMember} className="text-xs text-violet-400 border border-violet-800/50 px-3 py-1 rounded-lg hover:bg-violet-900/20 flex-shrink-0">
              + Add Member
            </button>
          </div>
          <div className="space-y-4">
            {data.team.map((m, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div>
                    <label className="text-slate-500 text-xs mb-1 block">Avatar initials</label>
                    <input
                      value={m.avatar}
                      onChange={e => setMember(i, 'avatar', e.target.value)}
                      placeholder="AR"
                      maxLength={2}
                      className="w-14 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-center text-sm font-bold focus:outline-none"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={m.name} onChange={e => setMember(i, 'name', e.target.value)} placeholder="Full Name" className={inp} />
                      <input value={m.role} onChange={e => setMember(i, 'role', e.target.value)} placeholder="CEO & Co-founder" className={inp} />
                    </div>
                    <textarea value={m.bio} onChange={e => setMember(i, 'bio', e.target.value)} rows={2} placeholder="Short bio…" className={ta} />
                  </div>
                  <button onClick={() => removeMember(i)} className="text-red-500 hover:text-red-400 px-1 mt-5">✕</button>
                </div>
              </div>
            ))}
            {data.team.length === 0 && (
              <button onClick={addMember} className="w-full border border-dashed border-slate-700 text-slate-500 hover:text-violet-400 hover:border-violet-700 rounded-xl py-4 text-sm transition-colors">
                + Add first team member
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Milestones ───────────────────────────────────────────────────── */}
      {tab === 'milestones' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Company Milestones" desc="Timeline of key events" />
            <button onClick={addMs} className="text-xs text-violet-400 border border-violet-800/50 px-3 py-1 rounded-lg hover:bg-violet-900/20 flex-shrink-0">
              + Add Milestone
            </button>
          </div>
          <div className="space-y-3">
            {data.milestones.map((ms, i) => (
              <div key={i} className="grid grid-cols-[120px_1fr_auto] gap-3 items-center">
                <input value={ms.year} onChange={e => setMs(i, 'year', e.target.value)} placeholder="2024 Q1" className={inp} />
                <input value={ms.event} onChange={e => setMs(i, 'event', e.target.value)} placeholder="Founded. First lines of code written." className={inp} />
                <button onClick={() => removeMs(i)} className="text-red-500 hover:text-red-400 px-2">✕</button>
              </div>
            ))}
            {data.milestones.length === 0 && (
              <button onClick={addMs} className="w-full border border-dashed border-slate-700 text-slate-500 hover:text-violet-400 hover:border-violet-700 rounded-xl py-4 text-sm transition-colors">
                + Add first milestone
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom save */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
