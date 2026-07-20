'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, ChevronDown, ChevronUp, Trash2, Shield } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

const PERMISSION_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  geo:         { label: 'GEO Optimizer',    icon: '🌐', desc: 'AI visibility scans & reports' },
  leads:       { label: 'Leads',            icon: '👥', desc: 'View and generate leads' },
  competitors: { label: 'Competitors',      icon: '🕵️', desc: 'View and add competitors' },
  content:     { label: 'Content',          icon: '✍️', desc: 'Create and publish content' },
  proposals:   { label: 'Proposals',        icon: '📄', desc: 'Create and send proposals' },
  tools:       { label: 'GTM Tools',        icon: '🎯', desc: 'Marketing & business plan tools' },
  audit:       { label: 'Website Audit',    icon: '🔍', desc: 'Run website audits' },
  reports:     { label: 'Progress Report',  icon: '📊', desc: 'View progress reports' },
  settings:    { label: 'Settings',         icon: '⚙️', desc: 'Modify workspace settings' },
  billing:     { label: 'Billing',          icon: '💳', desc: 'View billing & credits' },
}

const ROLE_META: Record<string, { label: string; color: string }> = {
  owner:  { label: 'Owner',  color: 'text-violet-400' },
  admin:  { label: 'Admin',  color: 'text-blue-400' },
  member: { label: 'Member', color: 'text-emerald-400' },
  viewer: { label: 'Viewer', color: 'text-slate-400' },
}

interface TeamMember {
  id: string
  user_id: string | null
  email: string
  name: string | null
  role: string
  status: string
  permissions: Record<string, boolean>
  credits_used: number
  action_count: number
  invite_link: string | null
  created_at: string
}

interface ActivityLog {
  id: string
  user_id: string
  user_email: string | null
  user_name: string | null
  action: string
  description: string | null
  credits_used: number
  created_at: string
}

// ─── Permission Checkbox Grid ─────────────────────────────────────────────────

function PermissionGrid({
  permissions,
  onChange,
  readonly,
}: {
  permissions: Record<string, boolean>
  onChange?: (key: string, val: boolean) => void
  readonly?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 mt-3">
      {Object.entries(PERMISSION_LABELS).map(([key, meta]) => {
        const checked = permissions[key] ?? false
        return (
          <label
            key={key}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
              checked
                ? 'bg-violet-950/30 border-violet-700/50'
                : 'bg-slate-800/30 border-slate-800 opacity-60'
            } ${readonly ? 'pointer-events-none' : 'hover:border-slate-700'}`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={e => onChange?.(key, e.target.checked)}
              disabled={readonly}
              className="w-3.5 h-3.5 accent-violet-600 flex-shrink-0"
            />
            <span className="text-sm flex-shrink-0">{meta.icon}</span>
            <span className={`text-xs font-medium ${checked ? 'text-slate-200' : 'text-slate-500'}`}>
              {meta.label}
            </span>
          </label>
        )
      })}
    </div>
  )
}

// ─── Member Row ───────────────────────────────────────────────────────────────

function MemberRow({
  member,
  isMe,
  canEdit,
  onRemove,
  onUpdate,
}: {
  member: TeamMember
  isMe: boolean
  canEdit: boolean
  onRemove: (id: string) => void
  onUpdate: (id: string, perms: Record<string, boolean>, role: string) => Promise<void>
}) {
  const [expanded, setExpanded]     = useState(false)
  const [perms, setPerms]           = useState(member.permissions)
  const [role, setRole]             = useState(member.role)
  const [saving, setSaving]         = useState(false)
  const [copied, setCopied]         = useState(false)
  const [removing, setRemoving]     = useState(false)

  const initials = (member.name || member.email || '?')[0].toUpperCase()
  const roleMeta = ROLE_META[member.role] ?? { label: member.role, color: 'text-slate-400' }
  const isPending = member.status === 'pending'

  async function save() {
    setSaving(true)
    await onUpdate(member.id, perms, role)
    setSaving(false)
    setExpanded(false)
  }

  async function remove() {
    if (!confirm(`Remove ${member.name || member.email} from the team?`)) return
    setRemoving(true)
    onRemove(member.id)
  }

  function copyLink() {
    if (!member.invite_link) return
    navigator.clipboard.writeText(member.invite_link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border-b border-slate-800/60 last:border-0">
      <div className="flex items-center gap-3 px-5 py-4">
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          isPending ? 'bg-slate-800 text-slate-500 border border-dashed border-slate-700'
                    : 'bg-violet-600/25 border border-violet-500/30 text-violet-300'
        }`}>
          {initials}
        </div>

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-white truncate">{member.name || member.email}</p>
            {isMe && <span className="text-[10px] text-slate-600">(you)</span>}
            {isPending && (
              <span className="text-[10px] bg-amber-950/40 text-amber-400 border border-amber-800/40 px-1.5 py-0.5 rounded-full">
                Pending
              </span>
            )}
          </div>
          {member.name && <p className="text-xs text-slate-500 truncate">{member.email}</p>}
        </div>

        {/* Role + stats */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-500">{member.credits_used} credits</p>
            <p className="text-xs text-slate-600">{member.action_count} actions</p>
          </div>
          <span className={`text-xs font-semibold ${roleMeta.color}`}>{roleMeta.label}</span>
        </div>

        {/* Actions */}
        {canEdit && !isMe && member.role !== 'owner' && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {isPending && member.invite_link && (
              <button
                onClick={copyLink}
                title="Copy invite link"
                className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-slate-800 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => setExpanded(v => !v)}
              title="Edit permissions"
              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800 transition-colors"
            >
              <Shield className="w-4 h-4" />
            </button>
            <button
              onClick={remove}
              disabled={removing}
              title="Remove member"
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => setExpanded(v => !v)} className="text-slate-600 hover:text-slate-400 transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Expanded permissions editor */}
      {expanded && canEdit && (
        <div className="px-5 pb-4 bg-slate-900/50 border-t border-slate-800/50">
          <div className="flex items-center gap-3 mt-3 mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</p>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Feature Access</p>
          <PermissionGrid
            permissions={perms}
            onChange={(key, val) => setPerms(p => ({ ...p, [key]: val }))}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={() => { setExpanded(false); setPerms(member.permissions); setRole(member.role) }}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────

export function TeamClient({
  callerUserId,
  callerRole,
  appUrl,
}: {
  callerUserId: string
  callerRole: string
  appUrl: string
}) {
  const [members, setMembers]         = useState<TeamMember[]>([])
  const [logs, setLogs]               = useState<ActivityLog[]>([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<'members' | 'activity'>('members')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName]   = useState('')
  const [inviteRole, setInviteRole]   = useState('member')
  const [invitePerms, setInvitePerms] = useState<Record<string, boolean>>(
    Object.fromEntries(Object.keys(PERMISSION_LABELS).map(k => [k, !['settings', 'billing'].includes(k)]))
  )
  const [showInvite, setShowInvite]   = useState(false)
  const [inviting, setInviting]       = useState(false)
  const [inviteLink, setInviteLink]   = useState('')
  const [linkCopied, setLinkCopied]   = useState(false)
  const [showPermsForm, setShowPermsForm] = useState(false)

  const canEdit = callerRole === 'owner' || callerRole === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    const [mRes, aRes] = await Promise.all([
      fetch('/api/team').then(r => r.json()),
      fetch('/api/team/activity?limit=50').then(r => r.json()),
    ])
    setMembers(mRes.members ?? [])
    setLogs(aRes.logs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName || undefined, role: inviteRole, permissions: invitePerms }),
    })
    const data = await res.json() as { invite_link?: string }
    if (data.invite_link) {
      setInviteLink(data.invite_link)
      await load()
    }
    setInviting(false)
  }

  async function updateMember(id: string, permissions: Record<string, boolean>, role: string) {
    await fetch(`/api/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions, role }),
    })
    await load()
  }

  function removeMember(id: string) {
    fetch(`/api/team/${id}`, { method: 'DELETE' }).then(() => load())
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
  }

  void appUrl

  return (
    <div className="space-y-5">
      {/* Invite card */}
      {canEdit && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-white">Invite Team Member</h2>
            <button
              onClick={() => { setShowInvite(v => !v); setInviteLink('') }}
              className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {showInvite ? 'Cancel' : '+ Invite'}
            </button>
          </div>

          {showInvite && (
            <form onSubmit={invite} className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="email" required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="sm:col-span-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500"
                />
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="Name (optional)"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                >
                  <option value="admin">Admin — full access</option>
                  <option value="member">Member — limited access</option>
                  <option value="viewer">Viewer — read-only</option>
                </select>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowPermsForm(v => !v)}
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  {showPermsForm ? 'Hide' : 'Set'} feature permissions
                </button>
                {showPermsForm && (
                  <PermissionGrid
                    permissions={invitePerms}
                    onChange={(k, v) => setInvitePerms(p => ({ ...p, [k]: v }))}
                  />
                )}
              </div>

              {inviteLink && (
                <div className="flex items-center gap-2 bg-slate-800 border border-violet-700/40 rounded-lg px-3 py-2.5">
                  <span className="text-slate-400 text-xs flex-1 truncate">{inviteLink}</span>
                  <button type="button" onClick={() => copyLink(inviteLink)}
                    className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors flex-shrink-0">
                    {linkCopied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Link</>}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={inviting}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {inviting ? 'Generating…' : inviteLink ? '↻ Regenerate Link' : 'Generate Invite Link →'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
        {(['members', 'activity'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors capitalize ${
              tab === t ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'members' ? `👥 Members (${members.length})` : '📋 Activity Log'}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {tab === 'members' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="px-5 py-10 text-center text-slate-500 text-sm">Loading…</div>
          ) : members.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-500 text-sm">No team members yet.</div>
          ) : (
            <div>
              {members.map(m => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isMe={m.user_id === callerUserId}
                  canEdit={canEdit}
                  onRemove={removeMember}
                  onUpdate={updateMember}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity tab */}
      {tab === 'activity' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800">
            <p className="text-sm font-semibold text-white">Recent Activity</p>
            <p className="text-xs text-slate-500 mt-0.5">All actions taken by team members</p>
          </div>
          {loading ? (
            <div className="px-5 py-10 text-center text-slate-500 text-sm">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-500 text-sm">No activity yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {logs.map(log => {
                const name = log.user_name || log.user_email || 'Unknown'
                const initials = name[0].toUpperCase()
                const time = new Date(log.created_at).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })
                return (
                  <div key={log.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0 mt-0.5">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-white">{name}</span>
                        <span className="text-xs text-slate-400">{log.description ?? log.action}</span>
                        {log.credits_used > 0 && (
                          <span className="text-[10px] text-violet-400 bg-violet-950/40 border border-violet-800/40 px-1.5 py-0.5 rounded-full">
                            {log.credits_used} credits
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">{time}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
