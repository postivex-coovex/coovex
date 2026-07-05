import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncBusinessMemory } from '@/lib/agent/sync-memory'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch the review
    const { data: review } = await supabase.from('reviews').select('*').eq('id', id).single()
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

    // Fetch business name for context
    const { data: business } = await supabase.from('businesses').select('name, industry').eq('id', review.business_id).single()

    const body = await request.json()
    const { action } = body  // 'generate' or 'save' (with response text)

    if (action === 'save') {
      const { response } = body
      if (!response) return NextResponse.json({ error: 'response text is required' }, { status: 400 })

      const { data: updated, error } = await supabase.from('reviews')
        .update({ response, status: 'responded', responded_at: new Date().toISOString() })
        .eq('id', id).select().single()

      if (error) throw error

      // Auto-sync AI memory after review response (fire-and-forget)
      const { data: biz } = await supabase.from('businesses').select('workspace_id').eq('id', review.business_id).maybeSingle()
      if (biz?.workspace_id) syncBusinessMemory(review.business_id, biz.workspace_id, 0).catch(() => {})

      return NextResponse.json({ review: updated })
    }

    // Generate AI response
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating)
    const sentiment = review.rating >= 4 ? 'positive' : review.rating === 3 ? 'neutral' : 'negative'

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === 'your_anthropic_api_key') {
      // Mock responses based on sentiment
      const mockResponses: Record<string, string> = {
        positive: `Thank you so much for your wonderful ${stars} review! We're thrilled to hear about your positive experience. Your feedback means a great deal to our team and motivates us to keep delivering the best service possible. We look forward to serving you again!`,
        neutral: `Thank you for taking the time to leave your feedback. We appreciate your honest review and are always looking for ways to improve. If there's anything specific we can do better, please don't hesitate to reach out to us directly.`,
        negative: `We sincerely apologize for falling short of your expectations. Your feedback is important to us, and we take it very seriously. We'd love the opportunity to make this right — please contact us directly so we can address your concerns personally.`,
      }
      return NextResponse.json({ draft: mockResponses[sentiment] })
    }

    const prompt = `Write a professional, empathetic response to this business review on behalf of "${business?.name || 'our business'}" (${business?.industry || 'business'}).

Review rating: ${review.rating}/5 ${stars}
Review text: "${review.body || '(no text provided)'}"

Requirements:
- Maximum 150 words
- Acknowledge the feedback specifically
- Professional but warm tone
- If negative: apologize sincerely and invite them to contact you
- If positive: thank them and invite them back
- Don't be generic — reference specifics from their review if possible
- Sign off as "The ${business?.name || 'Team'}"

Return only the response text, nothing else.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
    const data = await res.json()
    return NextResponse.json({ draft: data.content[0].text })
  } catch (error) {
    console.error('POST /api/reviews/[id]/respond error:', error)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
