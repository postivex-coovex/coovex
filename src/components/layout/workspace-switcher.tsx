'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Plus, Building2, Loader2 } from 'lucide-react'

interface WorkspaceItem {
  workspace_id: string
  business_name: string
  industry: string
  role: string
  plan: string
  is_current: boolean
}

const INDUSTRIES = [
  'SaaS / Tools', 'Digital Marketing Agency', 'IT Consulting', 'IT Service & Agency',
  'Technology', 'Marketing & Advertising', 'Consulting', 'E-commerce', 'Health & Wellness',
  'Education', 'Finance', 'Real Estate', 'Food & Beverage', 'Retail', 'Legal',
  'Construction', 'Design & Creative', 'Fitness', 'Travel & Hospitality', 'Other',
]

const PLAN_BADGE: Record<string, string> = {
  starter:    'text-slate-500',
  growth:     'text-blue-400',
  scale:      'text-blue-400',
  agency:     'text-slate-500',
  enterprise: 'text-blue-400',
}

interface Props {
  currentBusinessName: string
}

export function WorkspaceSwitcher({ currentBusinessName }: Props) {
  const router = useRouter()
  const [open, setOpen]           = useState(false)
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [loading, setLoading]     = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [addForm, setAddForm]     = useState({ business_name: '', industry: '', website_url: '' })
  const [adding, setAdding]       = useState(false)
  const [addErr, setAddErr]       = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Fetch workspaces when dropdown opens
  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/workspaces')
      .then(r => r.json())
      .then(d => setWorkspaces(d.workspaces ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setShowAdd(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function switchWorkspace(workspace_id: string) {
    setSwitching(workspace_id)
    try {
      const res = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id }),
      })
      if (!res.ok) return
      // Optimistically update local state so the button name changes immediately
      setWorkspaces(ws => ws.map(w => ({ ...w, is_current: w.workspace_id === workspace_id })))
      setOpen(false)
      router.refresh()
      router.push('/dashboard')
    } finally {
      setSwitching(null)
    }
  }

  async function addBusiness() {
    if (!addForm.business_name.trim() || !addForm.industry) {
      setAddErr('Business name and industry are required')
      return
    }
    setAdding(true)
    setAddErr('')
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (!res.ok) { setAddErr(data.error ?? 'Failed'); return }

      setOpen(false)
      setShowAdd(false)
      setAddForm({ business_name: '', industry: '', website_url: '' })
      // router.refresh() causes layout to re-read DB → onboarding_completed=false → modal appears
      router.refresh()
      router.push('/dashboard')
    } finally {
      setAdding(false)
    }
  }

  // Prefer name from loaded workspaces (updates on switch without waiting for layout re-render)
  const displayName = workspaces.find(w => w.is_current)?.business_name ?? currentBusinessName
  const initials = displayName.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')

  return (
    <div ref={ref} className="relative px-3 pt-2 pb-1">
      <button
        onClick={() => { setOpen(o => !o); setShowAdd(false) }}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800 transition-colors group"
      >
        {/* Business avatar */}
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
          {initials || <Building2 className="w-3.5 h-3.5" />}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-white text-sm font-medium truncate leading-tight">{displayName}</p>
          <p className="text-slate-600 text-[10px]">Switch business</p>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
          {/* Workspace list */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
            </div>
          ) : (
            <div className="py-1 max-h-60 overflow-y-auto">
              {workspaces.map(ws => (
                <button
                  key={ws.workspace_id}
                  onClick={() => !ws.is_current && switchWorkspace(ws.workspace_id)}
                  disabled={ws.is_current || switching === ws.workspace_id}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    ws.is_current
                      ? 'bg-blue-600/10 cursor-default'
                      : 'hover:bg-slate-800 cursor-pointer'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-md bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-300 flex-shrink-0">
                    {ws.business_name.split(' ').slice(0,2).map(w => w[0]?.toUpperCase() ?? '').join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${ws.is_current ? 'text-blue-300' : 'text-white'}`}>
                      {ws.business_name}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 text-[10px] truncate">{ws.industry}</span>
                      {ws.plan !== 'starter' && (
                        <span className={`text-[9px] font-medium uppercase ${PLAN_BADGE[ws.plan] ?? 'text-slate-500'}`}>
                          {ws.plan}
                        </span>
                      )}
                    </div>
                  </div>
                  {ws.is_current && <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                  {switching === ws.workspace_id && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {/* Divider + Add business */}
          <div className="border-t border-slate-800">
            {!showAdd ? (
              <button
                onClick={() => setShowAdd(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-md border border-dashed border-slate-700 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                Add Business
              </button>
            ) : (
              <div className="p-3 space-y-2.5">
                <p className="text-xs font-medium text-slate-300">New Business</p>

                <input
                  autoFocus
                  value={addForm.business_name}
                  onChange={e => setAddForm(f => ({ ...f, business_name: e.target.value }))}
                  placeholder="Business name *"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />

                <select
                  value={addForm.industry}
                  onChange={e => setAddForm(f => ({ ...f, industry: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none text-white"
                >
                  <option value="">Select industry *</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>

                <input
                  value={addForm.website_url}
                  onChange={e => setAddForm(f => ({ ...f, website_url: e.target.value }))}
                  placeholder="Website URL (optional)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />

                {addErr && <p className="text-red-400 text-xs">{addErr}</p>}

                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowAdd(false); setAddErr('') }}
                    className="flex-1 text-slate-400 hover:text-white text-sm py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addBusiness}
                    disabled={adding}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
                  >
                    {adding ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
