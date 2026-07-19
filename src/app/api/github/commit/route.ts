import { NextRequest, NextResponse } from 'next/server'
import { getUserGithubConfig, ghFetch, type StagedFile } from '@/lib/github'

// POST /api/github/commit — commit multiple staged files using Git Data API
export async function POST(req: NextRequest) {
  const gh = await getUserGithubConfig()
  if (!gh) return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 })

  const { owner, repo, branch, message, files } = await req.json() as {
    owner: string
    repo: string
    branch: string
    message: string
    files: StagedFile[]
  }

  if (!owner || !repo || !branch || !message || !files?.length) {
    return NextResponse.json({ error: 'owner, repo, branch, message, files required' }, { status: 400 })
  }

  const token = gh.token
  const base = `https://api.github.com/repos/${owner}/${repo}`

  // 1. Get current branch ref → commit SHA
  const refRes = await ghFetch(`${base}/git/refs/heads/${branch}`, token)
  if (!refRes.ok) return NextResponse.json({ error: `Branch "${branch}" not found` }, { status: 404 })
  const refData = await refRes.json() as { object: { sha: string } }
  const currentCommitSha = refData.object.sha

  // 2. Get the commit's tree SHA
  const commitRes = await ghFetch(`${base}/git/commits/${currentCommitSha}`, token)
  if (!commitRes.ok) return NextResponse.json({ error: 'Failed to get commit' }, { status: 502 })
  const commitData = await commitRes.json() as { tree: { sha: string } }
  const baseTreeSha = commitData.tree.sha

  // 3. Create blobs for each file
  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = []
  for (const file of files) {
    const blobRes = await ghFetch(`${base}/git/blobs`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
    })
    if (!blobRes.ok) return NextResponse.json({ error: `Failed to create blob for ${file.path}` }, { status: 502 })
    const blob = await blobRes.json() as { sha: string }
    treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha })
  }

  // 4. Create a new tree
  const treeRes = await ghFetch(`${base}/git/trees`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  })
  if (!treeRes.ok) return NextResponse.json({ error: 'Failed to create tree' }, { status: 502 })
  const treeData = await treeRes.json() as { sha: string }

  // 5. Create a commit
  const newCommitRes = await ghFetch(`${base}/git/commits`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: treeData.sha, parents: [currentCommitSha] }),
  })
  if (!newCommitRes.ok) return NextResponse.json({ error: 'Failed to create commit' }, { status: 502 })
  const newCommit = await newCommitRes.json() as { sha: string; html_url: string }

  // 6. Update branch ref
  const updateRes = await ghFetch(`${base}/git/refs/heads/${branch}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommit.sha }),
  })
  if (!updateRes.ok) return NextResponse.json({ error: 'Failed to update branch ref' }, { status: 502 })

  return NextResponse.json({ ok: true, commit_sha: newCommit.sha, commit_url: newCommit.html_url })
}
