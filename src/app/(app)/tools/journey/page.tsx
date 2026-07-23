'use client'

import { useState, useRef } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'

interface Touchpoint {
  id: string
  text: string
}

interface Stage {
  id: string
  name: string
  description: string
  emotion: 0 | 1 | 2 | 3
  touchpoints: Touchpoint[]
  channels: string[]
  notes: string
}

const EMOTIONS: { emoji: string; label: string; color: string }[] = [
  { emoji: '😟', label: 'Frustrated',  color: 'text-red-400'    },
  { emoji: '😐', label: 'Neutral',     color: 'text-slate-400'  },
  { emoji: '🙂', label: 'Satisfied',   color: 'text-slate-500'  },
  { emoji: '😄', label: 'Delighted',   color: 'text-blue-400'},
]

const CHANNEL_OPTIONS = ['Website', 'LinkedIn', 'Email', 'Phone', 'Event', 'Referral', 'Ad', 'Chat', 'Demo', 'Video']

const STAGE_COLORS = [
  'border-t-blue-500',   'border-t-violet-500', 'border-t-indigo-500',
  'border-t-amber-500',  'border-t-emerald-500','border-t-pink-500', 'border-t-cyan-500',
]

const DEFAULT_STAGES: Stage[] = [
  { id: '1', name: 'Awareness',      description: 'How do they discover you?',      emotion: 1, touchpoints: [{ id: 'a1', text: 'See LinkedIn post' }, { id: 'a2', text: 'Google search' }],           channels: ['LinkedIn', 'Ad'],    notes: '' },
  { id: '2', name: 'Interest',       description: 'What sparks their curiosity?',   emotion: 2, touchpoints: [{ id: 'b1', text: 'Visit website homepage' }, { id: 'b2', text: 'Read case study' }],      channels: ['Website', 'Email'],  notes: '' },
  { id: '3', name: 'Consideration',  description: 'How do they evaluate you?',      emotion: 2, touchpoints: [{ id: 'c1', text: 'Book a demo' }, { id: 'c2', text: 'Compare pricing' }],               channels: ['Demo', 'Website'],   notes: '' },
  { id: '4', name: 'Intent',         description: 'What triggers decision mode?',   emotion: 2, touchpoints: [{ id: 'd1', text: 'Request proposal' }, { id: 'd2', text: 'Internal approval' }],         channels: ['Email', 'Phone'],    notes: '' },
  { id: '5', name: 'Purchase',       description: 'How do they buy?',               emotion: 3, touchpoints: [{ id: 'e1', text: 'Sign contract' }, { id: 'e2', text: 'Onboarding call' }],              channels: ['Email', 'Video'],    notes: '' },
  { id: '6', name: 'Retention',      description: 'What keeps them coming back?',   emotion: 3, touchpoints: [{ id: 'f1', text: 'Monthly check-in' }, { id: 'f2', text: 'Feature updates' }],          channels: ['Email', 'Chat'],     notes: '' },
  { id: '7', name: 'Advocacy',       description: 'How do they refer others?',      emotion: 3, touchpoints: [{ id: 'g1', text: 'Leave G2 review' }, { id: 'g2', text: 'Refer a colleague' }],         channels: ['Referral', 'Event'], notes: '' },
]

let uid = 1000
function newId() { return String(++uid) }

function StageCard({
  stage, index, onUpdate, onDelete,
}: {
  stage: Stage; index: number
  onUpdate: (s: Stage) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [newTp, setNewTp] = useState('')
  const [newCh, setNewCh] = useState('')
  const borderColor = STAGE_COLORS[index % STAGE_COLORS.length]

  function addTouchpoint() {
    if (!newTp.trim()) return
    onUpdate({ ...stage, touchpoints: [...stage.touchpoints, { id: newId(), text: newTp.trim() }] })
    setNewTp('')
  }

  function removeTouchpoint(id: string) {
    onUpdate({ ...stage, touchpoints: stage.touchpoints.filter(t => t.id !== id) })
  }

  function toggleChannel(ch: string) {
    const has = stage.channels.includes(ch)
    onUpdate({ ...stage, channels: has ? stage.channels.filter(c => c !== ch) : [...stage.channels, ch] })
  }

  return (
    <div className={`w-56 flex-shrink-0 bg-slate-900 border border-slate-800 border-t-4 ${borderColor} rounded-xl flex flex-col`}>
      {/* Header */}
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-1">
          {editing === 'name' ? (
            <input
              autoFocus
              value={stage.name}
              onChange={e => onUpdate({ ...stage, name: e.target.value })}
              onBlur={() => setEditing(null)}
              className="bg-transparent text-white text-sm font-semibold border-b border-blue-500 outline-none w-full"
            />
          ) : (
            <button onClick={() => setEditing('name')} className="text-white text-sm font-semibold hover:text-blue-400 text-left">
              {stage.name}
            </button>
          )}
          <button onClick={onDelete} className="text-slate-600 hover:text-red-400 ml-2 flex-shrink-0">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        <p className="text-slate-500 text-[10px]">{stage.description}</p>
      </div>

      {/* Emotion */}
      <div className="px-3 py-2 border-b border-slate-800">
        <p className="text-slate-600 text-[10px] mb-1.5 uppercase tracking-wider">Customer Emotion</p>
        <div className="flex gap-1.5">
          {EMOTIONS.map((em, i) => (
            <button
              key={i}
              onClick={() => onUpdate({ ...stage, emotion: i as Stage['emotion'] })}
              className={`text-lg transition-all ${stage.emotion === i ? 'scale-125' : 'opacity-40 hover:opacity-70'}`}
              title={em.label}
            >
              {em.emoji}
            </button>
          ))}
        </div>
        <p className={`text-[10px] mt-1 ${EMOTIONS[stage.emotion].color}`}>{EMOTIONS[stage.emotion].label}</p>
      </div>

      {/* Touchpoints */}
      <div className="px-3 py-2 border-b border-slate-800 flex-1">
        <p className="text-slate-600 text-[10px] mb-1.5 uppercase tracking-wider">Touchpoints</p>
        <div className="space-y-1.5 mb-2">
          {stage.touchpoints.map(tp => (
            <div key={tp.id} className="flex items-start gap-1.5 group">
              <span className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0 mt-1.5" />
              <span className="text-slate-300 text-xs flex-1 leading-relaxed">{tp.text}</span>
              <button onClick={() => removeTouchpoint(tp.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 flex-shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            value={newTp}
            onChange={e => setNewTp(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTouchpoint()}
            placeholder="Add touchpoint…"
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button onClick={addTouchpoint} className="text-slate-500 hover:text-blue-400 px-1">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Channels */}
      <div className="px-3 py-2">
        <p className="text-slate-600 text-[10px] mb-1.5 uppercase tracking-wider">Channels</p>
        <div className="flex flex-wrap gap-1">
          {stage.channels.map(ch => (
            <button key={ch} onClick={() => toggleChannel(ch)}
              className="text-[10px] px-1.5 py-0.5 bg-slate-900/50 text-blue-300 border border-slate-700/40 rounded hover:bg-red-900/40 hover:text-red-300 hover:border-red-800/40 transition-colors">
              {ch}
            </button>
          ))}
          <div className="relative">
            <select
              value=""
              onChange={e => { if (e.target.value) toggleChannel(e.target.value) }}
              className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-500 border border-slate-700 rounded cursor-pointer focus:outline-none appearance-none"
            >
              <option value="">+ add</option>
              {CHANNEL_OPTIONS.filter(c => !stage.channels.includes(c)).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function JourneyPage() {
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES)
  const [mapName, setMapName] = useState('Customer Journey Map')
  const scrollRef = useRef<HTMLDivElement>(null)

  function addStage() {
    setStages(prev => [...prev, {
      id: newId(),
      name: 'New Stage',
      description: 'Describe this stage',
      emotion: 2,
      touchpoints: [],
      channels: [],
      notes: '',
    }])
    setTimeout(() => scrollRef.current?.scrollTo({ left: 99999, behavior: 'smooth' }), 50)
  }

  function updateStage(index: number, updated: Stage) {
    setStages(prev => prev.map((s, i) => i === index ? updated : s))
  }

  function deleteStage(index: number) {
    setStages(prev => prev.filter((_, i) => i !== index))
  }

  function exportPDF() {
    const win = window.open('', '_blank')
    if (!win) return
    const rows = stages.map(s => `
      <td style="border:1px solid #334155;padding:12px;vertical-align:top;min-width:160px;">
        <div style="font-weight:700;color:#fff;margin-bottom:4px;">${s.name}</div>
        <div style="font-size:20px;margin:8px 0;">${EMOTIONS[s.emotion].emoji} <span style="font-size:11px;color:#94a3b8;">${EMOTIONS[s.emotion].label}</span></div>
        <div style="font-size:11px;color:#64748b;margin-bottom:6px;">TOUCHPOINTS</div>
        ${s.touchpoints.map(t => `<div style="font-size:12px;color:#cbd5e1;margin-bottom:3px;">• ${t.text}</div>`).join('')}
        <div style="font-size:11px;color:#64748b;margin-top:8px;margin-bottom:4px;">CHANNELS</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">${s.channels.map(c => `<span style="font-size:10px;padding:2px 6px;background:#312e81;color:#a5b4fc;border-radius:4px;">${c}</span>`).join('')}</div>
      </td>
    `).join('')
    win.document.write(`
      <html><head><title>${mapName}</title><style>
        body{background:#0f172a;color:#f8fafc;font-family:system-ui;padding:32px;}
        table{border-collapse:collapse;width:100%;}
      </style></head><body>
      <h1 style="color:#fff;margin-bottom:24px;">${mapName}</h1>
      <table><tr>${rows}</tr></table>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <input
            value={mapName}
            onChange={e => setMapName(e.target.value)}
            className="text-2xl font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 outline-none transition-colors"
          />
          <p className="text-slate-400 text-sm mt-0.5">Click any field to edit • {stages.length} stages</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportPDF}
            className="px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-colors"
          >
            Export PDF
          </button>
          <button
            onClick={addStage}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Stage
          </button>
        </div>
      </div>

      {/* Emotion timeline */}
      <div className="flex-shrink-0 mb-4 bg-slate-900 border border-slate-800 rounded-xl px-6 py-4 overflow-x-auto">
        <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-3">Emotion Journey</p>
        <div className="flex items-end gap-0" style={{ minWidth: `${stages.length * 224}px` }}>
          {stages.map((s, i) => {
            const heights = [32, 56, 80, 104]
            const h = heights[s.emotion]
            const colors = ['bg-red-500', 'bg-slate-500', 'bg-slate-600', 'bg-blue-600']
            const color = colors[s.emotion]
            return (
              <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500">{EMOTIONS[s.emotion].emoji}</span>
                <div className={`w-full max-w-[48px] ${color} rounded-t opacity-70 transition-all duration-300`} style={{ height: h }} />
                <span className="text-slate-600 text-[9px] text-center truncate w-full px-1">{s.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stage cards */}
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {stages.map((stage, i) => (
          <StageCard
            key={stage.id}
            stage={stage}
            index={i}
            onUpdate={updated => updateStage(i, updated)}
            onDelete={() => deleteStage(i)}
          />
        ))}
        <button
          onClick={addStage}
          className="w-56 flex-shrink-0 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-600 hover:border-slate-700 hover:text-blue-500 transition-colors"
        >
          <Plus className="w-6 h-6" />
          <span className="text-sm font-medium">Add Stage</span>
        </button>
      </div>
    </div>
  )
}
