'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  GitBranch, FolderGit2, FolderOpen, Folder, FileCode, ChevronRight, ChevronDown,
  Send, Loader2, GitCommit, Trash2, Eye, X, Check, AlertCircle, ExternalLink,
  RefreshCw, LogOut, Plus
} from 'lucide-react'
import type { GitHubConfig, ActiveRepo, Repo, StagedFile } from '@/lib/github'

interface TreeFile { path: string; size: number; sha: string }
interface TreeNode { name: string; path: string; children: Map<string, TreeNode>; file?: TreeFile }

interface Message {
  role: 'user' | 'assistant'
  content: string
  new_staged?: StagedFile[]
}

function buildTree(files: TreeFile[]): TreeNode {
  const root: TreeNode = { name: '', path: '', children: new Map() }
  for (const f of files) {
    const parts = f.path.split('/')
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      if (!node.children.has(name)) {
        node.children.set(name, { name, path: parts.slice(0, i + 1).join('/'), children: new Map() })
      }
      node = node.children.get(name)!
    }
    node.file = f
  }
  return root
}

function TreeNodeRow({
  node, depth, expanded, onToggle, onFileClick, stagedPaths,
}: {
  node: TreeNode; depth: number; expanded: Set<string>; onToggle: (p: string) => void
  onFileClick: (path: string) => void; stagedPaths: Set<string>
}) {
  const isDir = !node.file
  const isExpanded = expanded.has(node.path)
  const isStaged = stagedPaths.has(node.path)

  return (
    <>
      <button
        onClick={() => isDir ? onToggle(node.path) : onFileClick(node.path)}
        className="w-full flex items-center gap-1.5 px-2 py-0.5 text-left hover:bg-slate-800/60 rounded group transition-colors"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {isDir ? (
          isExpanded
            ? <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
            : <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
        ) : <span className="w-3 flex-shrink-0" />}
        {isDir
          ? isExpanded
            ? <FolderOpen className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0" />
            : <Folder className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          : <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${isStaged ? 'text-emerald-400' : 'text-slate-500'}`} />
        }
        <span className={`text-[12px] truncate ${isDir ? 'text-slate-300' : isStaged ? 'text-emerald-300' : 'text-slate-400'}`}>
          {node.name}
        </span>
        {isStaged && <span className="ml-auto text-[9px] text-emerald-400 flex-shrink-0">M</span>}
      </button>
      {isDir && isExpanded && (
        <>
          {[...node.children.values()]
            .sort((a, b) => {
              if (!a.file && b.file) return -1
              if (a.file && !b.file) return 1
              return a.name.localeCompare(b.name)
            })
            .map(child => (
              <TreeNodeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                onFileClick={onFileClick}
                stagedPaths={stagedPaths}
              />
            ))}
        </>
      )}
    </>
  )
}

function FileViewer({ path, content, onClose }: { path: string; content: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-10 bg-slate-950 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900">
        <FileCode className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-300 font-mono">{path}</span>
        <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-[12px] text-slate-300 font-mono whitespace-pre-wrap break-all leading-relaxed">{content}</pre>
      </div>
    </div>
  )
}

function AssistantMessage({ msg }: { msg: Message }) {
  return (
    <div className="space-y-2">
      <div className="prose prose-invert prose-sm max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
        {msg.content}
      </div>
      {msg.new_staged && msg.new_staged.length > 0 && (
        <div className="space-y-1 pt-1">
          {msg.new_staged.map(f => (
            <div key={f.path} className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-700/30 rounded px-3 py-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-[12px] font-mono text-emerald-300">{f.path}</span>
              <span className="ml-auto text-[10px] text-emerald-500">staged</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Connect form ───────────────────────────────────────────────────────────────
function ConnectForm({ onConnected }: { onConnected: (cfg: GitHubConfig) => void }) {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConnect() {
    if (!token.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json() as { ok?: boolean; username?: string; avatar_url?: string; error?: string }
      if (!res.ok) { setError(data.error ?? 'Connection failed'); return }
      onConnected({ token: token.trim(), username: data.username!, avatar_url: data.avatar_url })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto">
            <FolderGit2 className="w-7 h-7 text-slate-300" />
          </div>
          <h2 className="text-xl font-semibold text-white">Connect GitHub</h2>
          <p className="text-sm text-slate-400">
            Paste a Personal Access Token with <strong className="text-slate-300">repo</strong> scope to get started.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConnect()}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          <button
            onClick={handleConnect}
            disabled={!token.trim() || loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderGit2 className="w-4 h-4" />}
            {loading ? 'Verifying...' : 'Connect GitHub'}
          </button>
        </div>

        <p className="text-xs text-slate-500 text-center">
          <a href="https://github.com/settings/tokens/new?scopes=repo" target="_blank" rel="noreferrer"
            className="text-blue-400 hover:underline inline-flex items-center gap-1">
            Create a token on GitHub <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>
    </div>
  )
}

// ── Repo selector ─────────────────────────────────────────────────────────────
function RepoSelector({ config, onSelected, onDisconnect }: {
  config: GitHubConfig
  onSelected: (repo: ActiveRepo) => void
  onDisconnect: () => void
}) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/github/repos')
      .then(r => r.json())
      .then((d: { repos?: Repo[] }) => setRepos(d.repos ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = repos.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-full items-start justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Select a Repository</h2>
            <p className="text-sm text-slate-400">Connected as <span className="text-white font-medium">{config.username}</span></p>
          </div>
          <button onClick={onDisconnect} className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
            <LogOut className="w-3.5 h-3.5" /> Disconnect
          </button>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search repositories..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
        ) : (
          <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map(repo => (
              <button
                key={repo.id}
                onClick={() => onSelected({ owner: repo.full_name.split('/')[0], repo: repo.name, branch: repo.default_branch, full_name: repo.full_name })}
                className="w-full text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg px-4 py-3 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">{repo.full_name}</span>
                  {repo.private && <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">private</span>}
                  {repo.language && <span className="ml-auto text-[11px] text-slate-500">{repo.language}</span>}
                </div>
                {repo.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{repo.description}</p>}
              </button>
            ))}
            {!loading && filtered.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No repositories found</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main coding interface ─────────────────────────────────────────────────────
export default function FolderGit2Client({ initialConfig }: { initialConfig: GitHubConfig | null }) {
  const [config, setConfig] = useState<GitHubConfig | null>(initialConfig)
  const [activeRepo, setActiveRepo] = useState<ActiveRepo | null>(initialConfig?.active_repo ?? null)
  const [tree, setTree] = useState<TreeFile[]>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [viewingFile, setViewingFile] = useState<{ path: string; content: string } | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [commitMsg, setCommitMsg] = useState('')
  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<{ sha: string; url: string } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const stagedPaths = new Set(stagedFiles.map(f => f.path))

  // Load file tree when repo changes
  useEffect(() => {
    if (!activeRepo) return
    setTree([]); setTreeLoading(true); setExpanded(new Set())
    fetch(`/api/github/tree?owner=${activeRepo.owner}&repo=${activeRepo.repo}&branch=${activeRepo.branch}`)
      .then(r => r.json())
      .then((d: { tree?: TreeFile[] }) => setTree(d.tree ?? []))
      .catch(() => {})
      .finally(() => setTreeLoading(false))
  }, [activeRepo])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const toggleDir = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  async function handleFileClick(path: string) {
    if (fileLoading) return
    // Check staged first
    const staged = stagedFiles.find(f => f.path === path)
    if (staged) { setViewingFile({ path, content: staged.content }); return }

    setFileLoading(true)
    try {
      const res = await fetch(
        `/api/github/file?owner=${activeRepo!.owner}&repo=${activeRepo!.repo}&path=${encodeURIComponent(path)}&branch=${activeRepo!.branch}`
      )
      const data = await res.json() as { content?: string; error?: string }
      if (data.content !== undefined) setViewingFile({ path, content: data.content })
    } finally {
      setFileLoading(false)
    }
  }

  async function handleSend() {
    const prompt = input.trim()
    if (!prompt || aiLoading || !activeRepo) return

    setInput(''); setAiError('')
    const userMsg: Message = { role: 'user', content: prompt }
    setMessages(prev => [...prev, userMsg])
    setAiLoading(true)

    try {
      const history = messages.slice(-12).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/github/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          history,
          owner: activeRepo.owner,
          repo: activeRepo.repo,
          branch: activeRepo.branch,
          existing_staged: stagedFiles,
        }),
      })
      const data = await res.json() as {
        message?: string
        new_staged?: StagedFile[]
        all_staged?: StagedFile[]
        error?: string
      }
      if (!res.ok) { setAiError(data.error ?? 'AI failed'); return }

      if (data.all_staged?.length) setStagedFiles(data.all_staged)
      const aiMsg: Message = { role: 'assistant', content: data.message ?? '', new_staged: data.new_staged ?? [] }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      setAiError('Network error — try again')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleCommit() {
    if (!activeRepo || !stagedFiles.length || !commitMsg.trim()) return
    setCommitting(true); setCommitResult(null)
    try {
      const res = await fetch('/api/github/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: activeRepo.owner,
          repo: activeRepo.repo,
          branch: activeRepo.branch,
          message: commitMsg.trim(),
          files: stagedFiles,
        }),
      })
      const data = await res.json() as { ok?: boolean; commit_sha?: string; commit_url?: string; error?: string }
      if (!res.ok) { alert(data.error ?? 'Commit failed'); return }
      setCommitResult({ sha: data.commit_sha!.slice(0, 7), url: data.commit_url! })
      setStagedFiles([]); setCommitMsg('')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Committed ${data.commit_sha!.slice(0, 7)} to ${activeRepo.branch}. Changes are now live on GitHub.`,
      }])
    } finally {
      setCommitting(false)
    }
  }

  async function handleSelectRepo(repo: ActiveRepo) {
    setActiveRepo(repo)
    setStagedFiles([]); setMessages([])
    // Persist active_repo in user's profile.github_config
    await fetch('/api/github/connect/repo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_repo: repo }),
    })
    if (config) setConfig({ ...config, active_repo: repo } as GitHubConfig)
  }

  async function handleDisconnect() {
    await fetch('/api/github/connect', { method: 'DELETE' })
    setConfig(null); setActiveRepo(null); setStagedFiles([]); setMessages([])
  }

  // ── Phase: not connected
  if (!config) {
    return (
      <ConnectForm onConnected={cfg => setConfig(cfg)} />
    )
  }

  // ── Phase: no repo selected
  if (!activeRepo) {
    return (
      <RepoSelector config={config} onSelected={handleSelectRepo} onDisconnect={handleDisconnect} />
    )
  }

  // ── Phase: full coding interface
  const treeRoot = buildTree(tree)

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* File viewer overlay */}
      {viewingFile && (
        <FileViewer path={viewingFile.path} content={viewingFile.content} onClose={() => setViewingFile(null)} />
      )}

      {/* ── Left panel: file tree + staged ── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-slate-800 bg-slate-900 overflow-hidden">
        {/* Repo header */}
        <div className="px-3 py-2.5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2 min-w-0">
            <FolderGit2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{activeRepo.full_name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <GitBranch className="w-3 h-3 text-slate-500" />
                <span className="text-[11px] text-slate-400">{activeRepo.branch}</span>
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => { setTree([]); setTreeLoading(true); setExpanded(new Set()); fetch(`/api/github/tree?owner=${activeRepo.owner}&repo=${activeRepo.repo}&branch=${activeRepo.branch}`).then(r => r.json()).then((d: { tree?: TreeFile[] }) => setTree(d.tree ?? [])).finally(() => setTreeLoading(false)) }}
                title="Refresh tree"
                className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveRepo(null)}
                title="Change repository"
                className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* File tree */}
        <div className="flex-1 overflow-y-auto py-1">
          {treeLoading ? (
            <div className="flex justify-center pt-8"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
          ) : (
            [...treeRoot.children.values()]
              .sort((a, b) => {
                if (!a.file && b.file) return -1
                if (a.file && !b.file) return 1
                return a.name.localeCompare(b.name)
              })
              .map(node => (
                <TreeNodeRow
                  key={node.path}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggleDir}
                  onFileClick={handleFileClick}
                  stagedPaths={stagedPaths}
                />
              ))
          )}
          {fileLoading && (
            <div className="text-center py-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 inline" /></div>
          )}
        </div>

        {/* Staged changes + commit */}
        {stagedFiles.length > 0 && (
          <div className="border-t border-slate-800 p-3 space-y-2 bg-slate-900/80">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <GitCommit className="w-3.5 h-3.5" /> Staged ({stagedFiles.length})
            </p>
            <div className="space-y-0.5 max-h-28 overflow-y-auto">
              {stagedFiles.map(f => (
                <div key={f.path} className="flex items-center gap-1.5 group">
                  <span className="text-[11px] text-emerald-300 font-mono truncate flex-1">{f.path}</span>
                  <button
                    onClick={() => setViewingFile({ path: f.path, content: f.content })}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-slate-300 transition-all"
                  ><Eye className="w-3 h-3" /></button>
                  <button
                    onClick={() => setStagedFiles(prev => prev.filter(s => s.path !== f.path))}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-red-400 transition-all"
                  ><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <textarea
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              placeholder="Commit message..."
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            {commitResult && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <Check className="w-3 h-3" />
                Pushed {commitResult.sha}
                <a href={commitResult.url} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-0.5">
                  view <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            )}
            <button
              onClick={handleCommit}
              disabled={!commitMsg.trim() || committing}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              {committing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCommit className="w-3.5 h-3.5" />}
              Commit & Push
            </button>
          </div>
        )}
      </div>

      {/* ── Right panel: AI chat ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {/* Chat header */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <GitBranch className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">AI Coding Assistant</p>
            <p className="text-[11px] text-slate-400">Reads files, writes code, commits to GitHub</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-3 pt-4">
              <p className="text-sm text-slate-400 text-center">What would you like to build?</p>
              <div className="grid grid-cols-1 gap-2 max-w-lg mx-auto">
                {[
                  'Generate a llms.txt file for this repo',
                  'Read the README and suggest improvements',
                  'Find any TODO comments and fix them',
                  'Create a CONTRIBUTING.md guide',
                ].map(p => (
                  <button
                    key={p}
                    onClick={() => { setInput(p); textareaRef.current?.focus() }}
                    className="text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-lg px-4 py-2.5 text-sm text-slate-300 hover:text-white transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <GitBranch className="w-3.5 h-3.5 text-violet-400" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white text-sm'
                  : 'bg-slate-800/80 border border-slate-700/50'
              }`}>
                {msg.role === 'assistant' ? <AssistantMessage msg={msg} /> : msg.content}
              </div>
            </div>
          ))}

          {aiLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
              </div>
              <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl px-4 py-2.5">
                <span className="text-sm text-slate-400">Reading repository...</span>
              </div>
            </div>
          )}

          {aiError && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-4 py-2.5 max-w-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {aiError}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-900/40">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder="Ask the AI to read, write, or fix anything in your repo... (Enter to send, Shift+Enter for newline)"
              rows={2}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || aiLoading}
              className="w-10 h-10 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
