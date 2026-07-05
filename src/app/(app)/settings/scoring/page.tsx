'use client'

import { useState } from 'react'
import { Plus, Trash2, Check, GripVertical } from 'lucide-react'

type Field = 'source' | 'email_domain' | 'company' | 'country' | 'stage' | 'score'
type Operator = 'equals' | 'contains' | 'not_equals' | 'starts_with' | 'is_any_of'

interface Rule {
  id: string
  field: Field
  operator: Operator
  value: string
  adjustment: number
  label: string
}

let uid = 100
function newId() { return String(++uid) }

const FIELD_OPTS: { value: Field; label: string }[] = [
  { value: 'source',       label: 'Lead Source'    },
  { value: 'email_domain', label: 'Email Domain'   },
  { value: 'company',      label: 'Company Name'   },
  { value: 'country',      label: 'Country'        },
  { value: 'stage',        label: 'Pipeline Stage' },
  { value: 'score',        label: 'Current Score'  },
]

const OP_OPTS: { value: Operator; label: string }[] = [
  { value: 'equals',     label: 'equals'       },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains',   label: 'contains'     },
  { value: 'starts_with',label: 'starts with'  },
  { value: 'is_any_of',  label: 'is any of'    },
]

const DEFAULT_RULES: Rule[] = [
  { id: '1', field: 'source',       operator: 'equals',  value: 'referral',   adjustment: +20, label: 'Referrals are high-intent' },
  { id: '2', field: 'source',       operator: 'equals',  value: 'cold_outreach', adjustment: -10, label: 'Cold outreach is low-intent' },
  { id: '3', field: 'email_domain', operator: 'contains',value: 'gmail.com',  adjustment: -5,  label: 'Personal email = lower commitment' },
  { id: '4', field: 'country',      operator: 'equals',  value: 'United Kingdom', adjustment: +10, label: 'Target market' },
  { id: '5', field: 'stage',        operator: 'equals',  value: 'proposal',   adjustment: +15, label: 'In proposal stage' },
]

function RuleRow({ rule, onChange, onDelete }: {
  rule: Rule
  onChange: (r: Rule) => void
  onDelete: () => void
}) {
  const isPositive = rule.adjustment > 0
  return (
    <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-800 rounded-xl p-3">
      <GripVertical className="w-4 h-4 text-slate-700 flex-shrink-0 cursor-grab" />

      <select value={rule.field} onChange={e => onChange({ ...rule, field: e.target.value as Field })}
        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500">
        {FIELD_OPTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>

      <select value={rule.operator} onChange={e => onChange({ ...rule, operator: e.target.value as Operator })}
        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-violet-500">
        {OP_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <input value={rule.value} onChange={e => onChange({ ...rule, value: e.target.value })}
        placeholder="value…"
        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-violet-500 min-w-0" />

      <span className="text-slate-500 text-xs flex-shrink-0">→</span>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onChange({ ...rule, adjustment: Math.max(-100, rule.adjustment - 5) })}
          className="w-6 h-6 rounded bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm">−</button>
        <span className={`text-sm font-bold w-12 text-center ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{rule.adjustment}
        </span>
        <button onClick={() => onChange({ ...rule, adjustment: Math.min(100, rule.adjustment + 5) })}
          className="w-6 h-6 rounded bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm">+</button>
      </div>

      <input value={rule.label} onChange={e => onChange({ ...rule, label: e.target.value })}
        placeholder="note…"
        className="w-36 bg-transparent border-0 text-slate-500 text-xs placeholder-slate-700 focus:outline-none" />

      <button onClick={onDelete} className="text-slate-700 hover:text-red-400 flex-shrink-0 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function ScoringRulesPage() {
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES)
  const [saved, setSaved] = useState(false)
  const [baseScore, setBaseScore] = useState(50)

  function addRule() {
    setRules(r => [...r, { id: newId(), field: 'source', operator: 'equals', value: '', adjustment: +10, label: '' }])
  }

  function updateRule(id: string, updated: Rule) {
    setRules(r => r.map(x => x.id === id ? updated : x))
  }

  function deleteRule(id: string) {
    setRules(r => r.filter(x => x.id !== id))
  }

  async function save() {
    // POST to /api/settings/scoring
    await fetch('/api/settings/scoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules, base_score: baseScore }),
    }).catch(() => {})
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const positiveRules = rules.filter(r => r.adjustment > 0)
  const negativeRules = rules.filter(r => r.adjustment < 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Scoring Rules</h1>
          <p className="text-slate-400 text-sm mt-0.5">Define rules that automatically adjust lead scores based on their attributes</p>
        </div>
        <button onClick={save}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors">
          {saved ? <><Check className="w-4 h-4" />Saved</> : 'Save Rules'}
        </button>
      </div>

      {/* Base score */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-white text-sm font-medium">Base Score</p>
            <p className="text-slate-500 text-xs">Starting score for all new leads before rules apply</p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button onClick={() => setBaseScore(s => Math.max(0, s - 5))}
              className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-lg">−</button>
            <span className="text-white text-2xl font-bold w-12 text-center">{baseScore}</span>
            <button onClick={() => setBaseScore(s => Math.min(100, s + 5))}
              className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-lg">+</button>
          </div>
        </div>
      </div>

      {/* Rules */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm">Scoring Rules ({rules.length})</h2>
          <button onClick={addRule}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs font-medium rounded-lg border border-violet-800/40 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </button>
        </div>

        <div className="text-xs text-slate-600 mb-3 grid grid-cols-[16px_1fr_1fr_1fr_auto_auto_1fr_auto] gap-2 px-3">
          <span />
          <span>Field</span>
          <span>Operator</span>
          <span>Value</span>
          <span />
          <span>Points</span>
          <span>Note</span>
          <span />
        </div>

        <div className="space-y-2">
          {rules.map(rule => (
            <RuleRow key={rule.id} rule={rule}
              onChange={updated => updateRule(rule.id, updated)}
              onDelete={() => deleteRule(rule.id)}
            />
          ))}
        </div>

        {rules.length === 0 && (
          <div className="text-center py-8 text-slate-600 text-sm">
            No rules yet. Click "Add Rule" to start.
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-4">
          <p className="text-emerald-400 text-xs font-semibold mb-2">Score Boosters ({positiveRules.length})</p>
          {positiveRules.map(r => (
            <div key={r.id} className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{r.field} {r.operator} &quot;{r.value}&quot;</span>
              <span className="text-emerald-400 font-medium">+{r.adjustment}</span>
            </div>
          ))}
        </div>
        <div className="bg-red-950/20 border border-red-800/30 rounded-xl p-4">
          <p className="text-red-400 text-xs font-semibold mb-2">Score Reducers ({negativeRules.length})</p>
          {negativeRules.map(r => (
            <div key={r.id} className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{r.field} {r.operator} &quot;{r.value}&quot;</span>
              <span className="text-red-400 font-medium">{r.adjustment}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
