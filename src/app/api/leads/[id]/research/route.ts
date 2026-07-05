import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

function resolveUrl(base: string, url: string): string {
  if (url.startsWith('http')) return url
  if (url.startsWith('//')) return `https:${url}`
  try { return new URL(url, base).href } catch { return url }
}

async function fetchSiteIcon(website: string): Promise<string | null> {
  try {
    const res = await fetch(website, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
    })
    if (!res.ok) return null
    const html = await res.text()

    // apple-touch-icon (180x180, highest quality)
    const appleMatch =
      html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*apple-touch-icon[^"']*["']/i)
    if (appleMatch?.[1]) return resolveUrl(website, appleMatch[1])

    // og:image — often a proper logo
    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (ogMatch?.[1]) return resolveUrl(website, ogMatch[1])

    // standard favicon link tag
    const faviconMatch =
      html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i)
    if (faviconMatch?.[1]) return resolveUrl(website, faviconMatch[1])

    // fallback: root favicon.ico
    return `${new URL(website).origin}/favicon.ico`
  } catch { return null }
}

async function searchSearX(query: string): Promise<{ title: string; url: string; content: string }[]> {
  const searxUrl = process.env.SEARCH_SERVICE_URL
  if (!searxUrl) return []
  try {
    const params = new URLSearchParams({ q: query, format: 'json' })
    const res = await fetch(`${searxUrl}/search?${params}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).slice(0, 6).map((r: { title: string; url: string; content: string }) => ({
      title:   r.title ?? '',
      url:     r.url ?? '',
      content: r.content ?? '',
    }))
  } catch { return [] }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: lead } = await supabase
    .from('leads')
    .select('name, email, phone, company, job_title, source, notes, website')
    .eq('id', id)
    .single()

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // Build search query
  const searchName   = lead.company || lead.name
  const locationHint = lead.notes?.split('·').slice(-1)[0]?.trim() ?? ''
  const query        = `"${searchName}" ${locationHint}`.trim()

  const results = await searchSearX(query)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const snippets = results.map((r, i) =>
    `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`
  ).join('\n\n')

  const prompt = `You are a sales intelligence analyst. Research this lead and extract all useful information.

LEAD INFO:
- Name: ${lead.name}
- Organization: ${lead.company ?? lead.notes ?? 'Unknown'}
- Job Title: ${lead.job_title ?? 'Unknown'}
- Notes: ${lead.notes ?? 'none'}
- Known Email: ${lead.email ?? 'unknown'}
- Known Phone: ${lead.phone ?? 'unknown'}
- Known Website: ${lead.website ?? 'unknown'}

WEB SEARCH RESULTS:
${snippets || 'No results found. Generate best-guess insights based on organization type.'}

Extract and return a JSON research report:
{
  "summary": "2-3 sentences about who they are and what they do",
  "website": "official website URL if found, or null",
  "found_email": "any email address found in search results (different from known email), or null",
  "found_phone": "any phone number found in search results, or null",
  "decision_maker": "who approves purchases here (job title/role)",
  "best_time_to_contact": "when and how best to reach them (specific days/times if known)",
  "insights": [
    "Key fact about their size, structure, or situation",
    "Their likely pain points or needs",
    "Their decision-making process or budget cycle"
  ],
  "talking_points": [
    "Specific opening angle tailored to them",
    "Pain point your product can solve for them specifically",
    "A compelling hook or local reference"
  ],
  "context_for_ai": "A paragraph of rich context (organization background, size, structure, needs) that AI should use when drafting emails or call scripts for this lead"
}

Be specific. If data is limited, make educated inferences based on their type (school, hospital, etc). Return ONLY the JSON.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 700,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (message.content[0] as { text: string }).text.trim()
  try {
    const json   = text.startsWith('{') ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    const parsed = JSON.parse(json)
    // Ensure website has protocol
    if (parsed.website && !parsed.website.startsWith('http')) {
      parsed.website = `https://${parsed.website}`
    }
    // Fetch icon from the website itself
    const siteUrl = parsed.website || lead.website
    const icon_url = siteUrl ? await fetchSiteIcon(siteUrl) : null
    return NextResponse.json({
      ...parsed,
      icon_url,
      sources: results.map(r => ({ title: r.title, url: r.url })),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to parse research', raw: text }, { status: 500 })
  }
}
