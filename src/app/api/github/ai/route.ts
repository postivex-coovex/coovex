import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUserGithubConfig, ghFetch, type StagedFile } from '@/lib/github'

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_files',
    description: 'List files and directories in the repository at a given path.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Directory path like "src/components". Leave empty for repo root.' },
      },
      required: [],
    },
  },
  {
    name: 'read_file',
    description: 'Read the full content of a file from the repository.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path, e.g. "src/app/page.tsx" or "README.md"' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or update a file. The change is staged and will be committed when the user clicks "Commit & Push".',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path to create or update, e.g. "llms.txt"' },
        content: { type: 'string', description: 'Full file content (do not truncate)' },
      },
      required: ['path', 'content'],
    },
  },
]

async function execListFiles(
  path: string | undefined,
  owner: string,
  repo: string,
  branch: string,
  token: string,
): Promise<string> {
  const p = (path ?? '').replace(/^\/+/, '')
  const url = p
    ? `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(p)}?ref=${branch}`
    : `https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`

  const res = await ghFetch(url, token)
  if (!res.ok) return JSON.stringify({ error: `Path "${p || '/'}" not found or not a directory` })

  const items = await res.json() as Array<{ name: string; type: string; path: string; size?: number }>
  return JSON.stringify({
    path: p || '/',
    items: items.map(i => ({ name: i.name, type: i.type, path: i.path, size: i.size })),
  })
}

async function execReadFile(
  path: string,
  owner: string,
  repo: string,
  branch: string,
  token: string,
  staged: StagedFile[],
): Promise<string> {
  // Check staged files first (most recent write wins)
  const stagedFile = staged.slice().reverse().find(f => f.path === path)
  if (stagedFile) return JSON.stringify({ content: stagedFile.content, source: 'staged (not yet committed)' })

  const res = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
    token,
  )
  if (!res.ok) return JSON.stringify({ error: `File "${path}" not found` })

  const data = await res.json() as { content?: string; size?: number }
  if (!data.content) return JSON.stringify({ error: 'Not a readable file' })

  // Large files: truncate at ~30KB to avoid blowing context
  const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
  const truncated = content.length > 30000
  return JSON.stringify({
    content: truncated ? content.slice(0, 30000) + '\n... [truncated at 30KB]' : content,
    size: data.size,
    truncated,
  })
}

export async function POST(req: NextRequest) {
  const gh = await getUserGithubConfig()
  if (!gh) return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  const {
    prompt,
    history = [],
    owner,
    repo,
    branch,
    existing_staged = [],
  } = await req.json() as {
    prompt: string
    history: Array<{ role: 'user' | 'assistant'; content: string }>
    owner: string
    repo: string
    branch: string
    existing_staged: StagedFile[]
  }

  if (!prompt || !owner || !repo || !branch) {
    return NextResponse.json({ error: 'prompt, owner, repo, branch required' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })
  const system = `You are an expert AI coding assistant for CooVex with full access to the GitHub repository ${owner}/${repo} on branch ${branch}.

You can:
- list_files(path?) — browse the directory structure
- read_file(path) — read any file
- write_file(path, content) — stage a file for commit (does NOT push yet; user clicks "Commit & Push" to deploy)

Guidelines:
- Always read relevant files before writing to understand the existing code style and structure
- Write complete, production-ready code — never truncate or use placeholders
- For llms.txt: follow the llms.txt spec (https://llmstxt.org) — include # Title, brief description, ## Sections with links
- For bug fixes: read the buggy file first, then write the corrected version
- Briefly explain what you read and what you wrote
- When you stage a file, mention the path so the user sees it in the staged panel`

  // Accumulated staged changes across this request
  const staged: StagedFile[] = [...existing_staged]

  // Build message history
  const messages: Anthropic.MessageParam[] = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: prompt },
  ]

  let finalText = ''

  // Agentic loop — up to 8 iterations
  for (let i = 0; i < 8; i++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system,
      tools: TOOLS,
      messages,
    })

    if (response.stop_reason !== 'tool_use') {
      finalText = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('')
      break
    }

    const toolUses = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const tu of toolUses) {
      const input = tu.input as Record<string, string>
      let result: string

      if (tu.name === 'list_files') {
        result = await execListFiles(input.path, owner, repo, branch, gh.token)
      } else if (tu.name === 'read_file') {
        result = await execReadFile(input.path, owner, repo, branch, gh.token, staged)
      } else if (tu.name === 'write_file') {
        // Upsert: overwrite if path already staged
        const idx = staged.findIndex(f => f.path === input.path)
        if (idx >= 0) staged[idx] = { path: input.path, content: input.content }
        else staged.push({ path: input.path, content: input.content })
        result = JSON.stringify({ success: true, staged: input.path, message: `Staged "${input.path}" — ready to commit.` })
      } else {
        result = JSON.stringify({ error: 'Unknown tool' })
      }

      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
    }

    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
  }

  // New staged files (only files added/updated in this request)
  const new_staged = staged.filter(f => {
    const prev = existing_staged.find(e => e.path === f.path)
    return !prev || prev.content !== f.content
  })

  return NextResponse.json({ message: finalText, new_staged, all_staged: staged })
}
