'use client'

import { useState } from 'react'
import { Copy, Check, Link } from 'lucide-react'

type UserRole = 'owner' | 'admin' | 'member' | 'viewer'

interface Member {
  user_id: string
  role: UserRole
  joined_at: string | null
  profile: { id: string; name: string | null; email: string | null } | null
}

interface TeamClientProps {
  members: Member[]
  currentUserId: string
  workspaceId: string
}

const ROLE_META: Record<UserRole, { label: string; color: string; desc: string }> = {
  owner: { label: 'Owner', color: 'text-violet-400', desc: 'Full access, billing, delete workspace' },
  admin: { label: 'Admin', color: 'text-blue-400', desc: 'Manage team, all features' },
  member: { label: 'Member', color: 'text-emerald-400', desc: 'Create and edit content, leads, reviews' },
  viewer: { label: 'Viewer', color: 'text-slate-400', desc: 'View-only access' },
}

export default function TeamClient({ members, currentUserId, workspaceId }: TeamClientProps) {
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

  void workspaceId

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setInviteLink('')
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: inviteRole, email: inviteEmail || undefined }),
    })
    const data = await res.json()
    if (data.link) setInviteLink(data.link)
    setInviting(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      {/* Invite card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Invite Team Member</h2>
          {!showInvite && (
            <button onClick={() => setShowInvite(true)} className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors">
              + Invite
            </button>
          )}
        </div>

        {showInvite && (
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email address</label>
                <input
                  type="email" required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as UserRole)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none appearance-none"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            {inviteRole && (
              <p className="text-slate-500 text-xs">{ROLE_META[inviteRole].desc}</p>
            )}
            {inviteLink && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center gap-2">
                <Link className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                <span className="text-slate-300 text-xs flex-1 truncate">{inviteLink}</span>
                <button type="button" onClick={copyLink}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 rounded border border-slate-600 flex-shrink-0 transition-colors">
                  {copied ? <><Check className="w-3 h-3 text-emerald-400" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowInvite(false); setInviteLink('') }} className="text-slate-400 hover:text-white text-sm transition-colors">Cancel</button>
              <button type="submit" disabled={inviting} className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                {inviting ? 'Generating…' : inviteLink ? 'Regenerate Link' : 'Generate Invite Link'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Members list */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold">Members ({members.length})</h2>
        </div>
        <div className="divide-y divide-slate-800/60">
          {members.map(member => {
            const roleMeta = ROLE_META[member.role] || ROLE_META.viewer
            const isCurrentUser = member.user_id === currentUserId
            const initials = (member.profile?.name || member.profile?.email || '?')[0].toUpperCase()
            return (
              <div key={member.user_id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-violet-300 text-sm font-bold flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium">{member.profile?.name || 'Unknown'}</p>
                    {isCurrentUser && <span className="text-xs text-slate-600">(you)</span>}
                  </div>
                  <p className="text-slate-500 text-xs">{member.profile?.email || ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${roleMeta.color}`}>{roleMeta.label}</span>
                  {member.joined_at && (
                    <span className="text-slate-600 text-xs">
                      Joined {new Date(member.joined_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Role reference */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Role Permissions</h3>
        <div className="space-y-2">
          {(Object.entries(ROLE_META) as [UserRole, typeof ROLE_META[UserRole]][]).map(([role, meta]) => (
            <div key={role} className="flex items-center gap-3">
              <span className={`text-xs font-medium w-16 ${meta.color}`}>{meta.label}</span>
              <span className="text-slate-500 text-xs">{meta.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
