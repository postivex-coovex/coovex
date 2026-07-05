import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/credits'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()
    if (!profile?.current_workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const type = body.type as 'llms_txt' | 'jsonld'
    if (!type || !['llms_txt', 'jsonld'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be llms_txt or jsonld.' }, { status: 400 })
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('name, website_url, industry, description, website_intel')
      .eq('workspace_id', profile.current_workspace_id)
      .maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business found' }, { status: 400 })

    // Deduct 3 credits for content generation
    const credit = await deductCredits(profile.current_workspace_id, 'review_response', `GEO content generation: ${type}`)
    if (!credit.ok) return NextResponse.json({ error: credit.error }, { status: 402 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === 'your_anthropic_api_key') {
      return NextResponse.json({ error: 'AI not configured' }, { status: 500 })
    }

    const intel = business.website_intel as Record<string, unknown> | null
    const services: string[] = (intel?.services as string[]) ?? []
    const description: string = business.description || (intel?.description as string) || ''
    const contact = (intel?.contact as Record<string, string>) ?? {}
    const website = business.website_url || ''
    const name = business.name || 'My Business'
    const industry = business.industry || (intel?.industry as string) || ''

    const anthropic = new Anthropic({ apiKey })

    let prompt = ''

    if (type === 'llms_txt') {
      prompt = `Generate a proper llms.txt file for this business. llms.txt is an emerging standard that helps AI models (Perplexity, ChatGPT, Gemini, Claude) understand and recommend the business.

Business details:
- Name: ${name}
- Industry: ${industry}
- Description: ${description}
- Services: ${services.join(', ') || 'N/A'}
- Website: ${website}
- Email: ${contact.email || 'N/A'}
- Phone: ${contact.phone || 'N/A'}

Generate a complete llms.txt file following this format exactly:

# [Business Name]
> [One compelling line describing what they do]

[2-3 paragraph description written for AI models to understand the business — clear, factual, comprehensive]

## Services
- [service 1]
- [service 2]
[etc]

## Industries Served
- [industry 1]
[etc, if applicable]

## Contact
- Website: [url]
- Email: [email if available]
- Phone: [phone if available]

## Key Information
- [Important fact 1]
- [Important fact 2]
[2-4 key facts about the business]

Return only the llms.txt content, no explanation or markdown wrapping.`
    } else {
      prompt = `Generate a complete Organization JSON-LD structured data schema for this business. This will be embedded in HTML as <script type="application/ld+json">.

Business details:
- Name: ${name}
- Industry: ${industry}
- Description: ${description}
- Services: ${services.join(', ') || 'N/A'}
- Website: ${website}
- Email: ${contact.email || ''}
- Phone: ${contact.phone || ''}

Generate a complete, valid JSON-LD object using Schema.org Organization type. Include:
- @context, @type (Organization)
- name, description, url
- logo (use website + /logo.png as placeholder)
- contactPoint
- sameAs (leave as empty array [])
- offers array for services if applicable
- knowsAbout array for industry topics

Return only valid JSON (the object, not wrapped in script tags), no explanation.`
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    if (!content) return NextResponse.json({ error: 'Generation returned empty content' }, { status: 500 })

    // For JSON-LD, wrap in script tag for convenience
    let finalContent = content
    if (type === 'jsonld') {
      // Validate it parses
      try {
        const parsed = JSON.parse(content)
        finalContent = `<script type="application/ld+json">\n${JSON.stringify(parsed, null, 2)}\n</script>`
      } catch {
        // Return as-is if not parseable
        finalContent = `<script type="application/ld+json">\n${content}\n</script>`
      }
    }

    return NextResponse.json({ content: finalContent }, { headers: { 'X-Credits-Remaining': String(credit.balance) } })
  } catch (error) {
    console.error('POST /api/geo/generate error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
