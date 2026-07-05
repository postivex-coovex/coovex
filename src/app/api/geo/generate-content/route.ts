import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createHmac } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

const GAP_TYPE_CHANNEL: Record<string, string> = {
  comparison:              'wordpress',
  faq:                     'wordpress',
  'how-to':                'wordpress',
  guide:                   'wordpress',
  'integration-guide':     'wordpress',
  'use-case':              'wordpress',
  'competitive-positioning':'wordpress',
  'brand-entity':          'wordpress',
  'case-study':            'linkedin',
  listicle:                'linkedin',
  landing:                 'linkedin',
}

const GAP_TYPE_PROMPT: Record<string, (suggestion: string, biz: string, industry: string) => string> = {
  comparison: (s, b, i) =>
    `Write a detailed comparison blog post for ${b} (${i} industry). Topic: "${s}".
Format: H1 title, intro paragraph, comparison table or side-by-side analysis (3-5 points), why ${b} is the right choice, conclusion with CTA. 600-800 words. Friendly but professional tone.`,

  faq: (s, b, i) =>
    `Write a comprehensive FAQ article for ${b} (${i}). Topic: "${s}".
Format: H1 title, brief intro, 8-10 Q&A pairs covering common customer questions, closing paragraph with CTA to contact ${b}. 500-700 words. Clear, helpful tone.`,

  'how-to': (s, b, i) =>
    `Write a step-by-step how-to guide for ${b} (${i}). Topic: "${s}".
Format: H1 title, intro (what reader will achieve), numbered steps (5-8 steps), pro tips section, conclusion with CTA. 600-800 words. Practical, actionable tone.`,

  guide: (s, b, i) =>
    `Write a comprehensive guide for ${b} (${i}). Topic: "${s}".
Format: H1 title, intro explaining why this matters, 4-6 sections with subheadings, practical examples, conclusion with CTA to try ${b}. 700-900 words. Authoritative, educational tone.`,

  'integration-guide': (s, b, i) =>
    `Write a technical integration guide for ${b} (${i}). Topic: "${s}".
Format: H1 title, overview of the integration value, prerequisites, step-by-step setup (numbered), code/config examples where relevant, troubleshooting tips, CTA. 700-900 words. Clear, developer-friendly tone.`,

  'use-case': (s, b, i) =>
    `Write a use-case article for ${b} (${i}). Topic: "${s}".
Format: H1 title, the problem/scenario, how ${b} solves it (step-by-step), business value delivered, real-world example (can be illustrative), CTA. 600-800 words. Storytelling with practical depth.`,

  'competitive-positioning': (s, b, i) =>
    `Write a competitive positioning blog post for ${b} (${i}). Topic: "${s}".
Format: H1 title, intro setting the landscape, side-by-side comparison of 2-3 alternatives vs ${b} on 4-5 criteria (table or bullets), clear recommendation, conclusion with CTA. 600-800 words. Objective but ${b}-favoring tone.`,

  'brand-entity': (s, b, i) =>
    `Write an authoritative brand entity page for ${b} (${i}). Topic: "${s}".
Format: H1 title, what ${b} is (definition), who it serves, what makes it unique, key features/capabilities, social proof signals, clear CTA. 400-600 words. Confident, factual, optimized for AI citation.`,

  'case-study': (s, b, i) =>
    `Write a LinkedIn post as a case study for ${b} (${i}). Topic: "${s}".
Format: Strong hook first line, the problem, the solution (how ${b} helped), measurable results (use realistic example numbers), key takeaway, CTA. 900-1200 characters. Professional, story-driven tone.`,

  listicle: (s, b, i) =>
    `Write a LinkedIn list post for ${b} (${i}). Topic: "${s}".
Format: Hook first line, numbered list (5-7 points with brief explanation each), closing insight mentioning ${b}, CTA. 900-1200 characters. Engaging, value-packed tone.`,

  landing: (s, b, i) =>
    `Write a LinkedIn post for ${b} (${i}) that communicates the value proposition for: "${s}".
Format: Hook, pain point, solution ${b} offers, 3 key benefits, social proof hint, CTA. 800-1100 characters. Confident, conversion-focused tone.`,
}

// Fallback for any type Claude invents that we haven't mapped
const fallbackPrompt = (s: string, b: string, i: string) =>
  `Write a well-structured blog article for ${b} (${i} industry). Topic: "${s}".
Format: H1 title, intro, 3-4 main sections with subheadings, conclusion with CTA. 600-800 words. Professional, helpful tone.`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    // Use getSession to avoid Auth API rate limits — credit deduction validates workspace ownership
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('current_workspace_id').eq('id', session.user.id).single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const { type, suggestion } = await req.json() as { type: string; suggestion: string }
    if (!type || !suggestion) return NextResponse.json({ error: 'type and suggestion required' }, { status: 400 })

    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, industry, description, api_key, webhook_url, webhook_secret, auto_push')
      .eq('workspace_id', profile.current_workspace_id)
      .maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business found' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

    const credit = await deductCredits(profile.current_workspace_id, 'content_generate', `GEO content: ${type}`)
    if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })

    const channel = GAP_TYPE_CHANNEL[type] ?? 'wordpress'
    const promptFn = GAP_TYPE_PROMPT[type] ?? fallbackPrompt
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const promptText = `Today's date: ${currentDate}. Write current, up-to-date content — use ${new Date().getFullYear()} as the reference year for any statistics, trends, or comparisons.\n\n` + promptFn(suggestion, business.name, business.industry || 'business')

    const anthropic = new Anthropic({ apiKey })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: promptText }],
    })

    const content = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    if (!content) return NextResponse.json({ error: 'Generation returned empty content' }, { status: 500 })

    const firstLine = content.split('\n')[0].replace(/^#+\s*/, '').slice(0, 120)
    const title = firstLine || suggestion.slice(0, 120)

    const { data: post, error: insertError } = await supabase
      .from('posts')
      .insert({
        business_id: business.id,
        channel,
        title,
        content,
        status: 'draft',
        created_by: session.user.id,
      })
      .select('id, channel, title, status')
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    // Auto-push to webhook if configured AND auto_push is enabled
    let pushed = false
    let pushError: string | null = null
    if (business.auto_push && business.webhook_url && post) {
      try {
        const payload = {
          post_id: post.id,
          title: post.title ?? '',
          content,
          channel,
          status: post.status,
          business: business.name,
          confirm_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/public/posts/${post.id}/confirm`,
          api_key: business.api_key,
          pushed_at: new Date().toISOString(),
        }
        const body = JSON.stringify(payload)
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-CooVex-Event': 'post.push',
          'X-CooVex-Post-Id': post.id,
        }
        if (business.webhook_secret) {
          const sig = createHmac('sha256', business.webhook_secret).update(body).digest('hex')
          headers['X-CooVex-Signature'] = `sha256=${sig}`
        }
        const res = await fetch(business.webhook_url, {
          method: 'POST', headers, body,
          signal: AbortSignal.timeout(10000),
        })
        const service = createServiceClient()
        if (res.ok) {
          await service.from('posts').update({ webhook_status: 'pushed' }).eq('id', post.id)
          pushed = true
        } else {
          await service.from('posts').update({ webhook_status: 'failed' }).eq('id', post.id)
          pushError = `Webhook returned ${res.status}`
        }
      } catch (e) {
        pushError = e instanceof Error ? e.message : 'Push failed'
      }
    }

    // Persist generated gap suggestion to agent_memory so "View" survives reload
    try {
      const service2 = createServiceClient()
      const memKey = 'geo_generated_gaps'
      const { data: existing } = await service2
        .from('agent_memory').select('id, value_text')
        .eq('business_id', business.id).eq('key', memKey).maybeSingle()
      const list: string[] = existing?.value_text ? JSON.parse(existing.value_text) : []
      if (!list.includes(suggestion)) list.push(suggestion)
      if (existing) {
        await service2.from('agent_memory').update({ value_text: JSON.stringify(list) }).eq('id', existing.id)
      } else {
        await service2.from('agent_memory').insert({ business_id: business.id, key: memKey, value_text: JSON.stringify(list) })
      }
    } catch { /* non-critical */ }

    return NextResponse.json({ post, channel, title, pushed, pushError }, { headers: { 'X-Credits-Remaining': String(credit.balance) } })
  } catch (e) {
    console.error('POST /api/geo/generate-content error:', e)
    return NextResponse.json({ error: 'Content generation failed' }, { status: 500 })
  }
}
