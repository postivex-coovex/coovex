import type { PostPayload, PublishResult } from './types'

export interface GitHubCredentials {
  token: string
  owner: string
  repo: string
  branch?: string
  content_path?: string
  file_format?: 'markdown' | 'html'
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

function buildMarkdown(post: PostPayload): string {
  const date = new Date().toISOString()
  const lines = [
    '---',
    `title: "${post.title.replace(/"/g, '\\"')}"`,
    `slug: "${post.slug}"`,
    `date: "${date}"`,
  ]
  if (post.meta_description) lines.push(`description: "${post.meta_description.replace(/"/g, '\\"')}"`)
  if (post.tags?.length)      lines.push(`tags: [${post.tags.map(t => `"${t}"`).join(', ')}]`)
  lines.push('---', '', post.content)
  return lines.join('\n')
}

function buildHtml(post: PostPayload): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    `  <meta charset="UTF-8">`,
    `  <title>${post.meta_title ?? post.title}</title>`,
    post.meta_description ? `  <meta name="description" content="${post.meta_description}">` : '',
    '</head>',
    '<body>',
    `  <article>`,
    `    <h1>${post.title}</h1>`,
    `    ${post.content}`,
    `  </article>`,
    '</body>',
    '</html>',
  ].filter(Boolean).join('\n')
}

export async function publishToGitHub(
  credentials: GitHubCredentials,
  post: PostPayload,
): Promise<PublishResult> {
  const { token, owner, repo, branch = 'main', content_path = 'content/blog', file_format = 'markdown' } = credentials

  const date = new Date().toISOString().split('T')[0]
  const slug = post.slug || slugify(post.title)
  const ext = file_format === 'markdown' ? 'md' : 'html'
  const filename = `${date}-${slug}.${ext}`
  const filePath = `${content_path.replace(/^\/|\/$/g, '')}/${filename}`
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`

  const fileContent = file_format === 'markdown' ? buildMarkdown(post) : buildHtml(post)
  const contentBase64 = Buffer.from(fileContent).toString('base64')

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }

  try {
    // Check if file exists for SHA (update vs create)
    let sha: string | undefined
    const checkRes = await fetch(apiUrl, { headers: ghHeaders })
    if (checkRes.ok) {
      const existing = await checkRes.json() as { sha: string }
      sha = existing.sha
    }

    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify({
        message: `feat: add post "${post.title}"`,
        content: contentBase64,
        branch,
        ...(sha ? { sha } : {}),
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string }
      return { integration: 'github', success: false, error: err.message ?? `HTTP ${res.status}` }
    }

    const data = await res.json() as { content: { html_url: string } }
    return { integration: 'github', success: true, url: data.content?.html_url }
  } catch (e) {
    return { integration: 'github', success: false, error: String(e) }
  }
}

export async function testGitHubConnection(credentials: GitHubCredentials): Promise<{ ok: boolean; msg: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${credentials.owner}/${credentials.repo}`, {
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        Accept: 'application/vnd.github+json',
      },
    })
    if (res.status === 401) return { ok: false, msg: 'Invalid GitHub token' }
    if (res.status === 404) return { ok: false, msg: `Repo ${credentials.owner}/${credentials.repo} not found or not accessible` }
    if (!res.ok) return { ok: false, msg: `GitHub API error: ${res.status}` }
    const data = await res.json() as { full_name: string; default_branch: string }
    return { ok: true, msg: `Connected to ${data.full_name} (default branch: ${data.default_branch})` }
  } catch {
    return { ok: false, msg: 'Cannot reach GitHub API' }
  }
}
