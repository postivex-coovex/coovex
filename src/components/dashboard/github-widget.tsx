'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FolderGit2, GitBranch, ArrowRight, Loader2, Check } from 'lucide-react'
import type { GitHubConfig } from '@/lib/github'

export function GithubWidget() {
  const [gh, setGh] = useState<GitHubConfig | null | undefined>(undefined)

  useEffect(() => {
    fetch('/api/github/me')
      .then(r => r.json())
      .then((d: { config?: GitHubConfig }) => setGh(d.config ?? null))
      .catch(() => setGh(null))
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
        {gh && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-900/20 border border-emerald-700/30 rounded-full px-2 py-0.5">
            <Check className="w-3 h-3" /> Connected
          </span>
        )}
      </div>

      {gh === undefined ? (
        <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-slate-500" /></div>
      ) : gh ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2">
            <FolderGit2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-xs text-slate-300 truncate">{gh.username}</span>
            {gh.active_repo && (
              <>
                <span className="text-slate-600">/</span>
                <GitBranch className="w-3 h-3 text-slate-500 flex-shrink-0" />
                <span className="text-xs text-slate-400 truncate">{gh.active_repo.full_name}</span>
              </>
            )}
          </div>
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
            Connect your personal GitHub to use AI to generate files, fix bugs, and push changes directly.
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
