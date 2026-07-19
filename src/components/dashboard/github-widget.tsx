'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FolderGit2, GitBranch, ArrowRight, Loader2, Check } from 'lucide-react'

interface GitHubState {
  connected: boolean
  username?: string
  avatar_url?: string
  active_repo?: {
    full_name: string
    branch: string
  }
}

export function GithubWidget() {
  const [state, setState] = useState<GitHubState | null>(null)

  useEffect(() => {
    fetch('/api/integrations')
      .then(r => r.json())
      .then((d: { integrations?: Record<string, unknown> }) => {
        const gh = d.integrations?.github as Record<string, unknown> | undefined
        if (gh?.token) {
          setState({
            connected: true,
            username: gh.username as string,
            avatar_url: gh.avatar_url as string,
            active_repo: gh.active_repo as { full_name: string; branch: string } | undefined,
          })
        } else {
          setState({ connected: false })
        }
      })
      .catch(() => setState({ connected: false }))
  }, [])

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
          <FolderGit2 className="w-4 h-4 text-slate-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">GitHub Coding</p>
          <p className="text-xs text-slate-400">AI-powered code editor</p>
        </div>
        {state?.connected && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-900/20 border border-emerald-700/30 rounded-full px-2 py-0.5">
            <Check className="w-3 h-3" /> Connected
          </span>
        )}
      </div>

      {state === null ? (
        <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-slate-500" /></div>
      ) : state.connected ? (
        <div className="space-y-2">
          {state.active_repo ? (
            <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2">
              <GitBranch className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-300 truncate">{state.active_repo.full_name}</span>
              <span className="text-[10px] text-slate-500">/{state.active_repo.branch}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No repository selected</p>
          )}
          <Link
            href="/github"
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            Open AI Coding
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            Connect your GitHub repository to use AI to generate files, fix bugs, and push changes directly.
          </p>
          <Link
            href="/github"
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            <FolderGit2 className="w-4 h-4" />
            Connect GitHub
          </Link>
        </div>
      )}
    </div>
  )
}
