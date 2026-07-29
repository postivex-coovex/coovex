/**
 * POST /api/wp-dev/usage
 * Called by the VPS agent after each session to deduct credits.
 * Internal-only — requires x-internal-secret header.
 *
 * Credit rates (haiku-4-5, 25% markup, 100 credits = $1):
 *   Input tokens:  $0.25/M → $0.3125/M with markup → 31.25 credits/M tokens
 *   Output tokens: $1.25/M → $1.5625/M with markup → 156.25 credits/M tokens
 *   Image low:     $0.02   → $0.025               → 3 credits
 *   Image medium:  $0.04   → $0.05                → 5 credits
 *   Image high:    $0.08   → $0.10                → 10 credits
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { deductCreditsAmount } from '@/lib/credits'

const INPUT_CREDITS_PER_M  = 31.25   // haiku input, 25% markup
const OUTPUT_CREDITS_PER_M = 156.25  // haiku output, 25% markup
const IMAGE_CREDITS = { low: 3, medium: 5, high: 10 }

function calculateCredits(usage: {
  inputTokens: number
  outputTokens: number
  images: { low: number; medium: number; high: number }
}): number {
  const textCredits =
    (usage.inputTokens  / 1_000_000) * INPUT_CREDITS_PER_M +
    (usage.outputTokens / 1_000_000) * OUTPUT_CREDITS_PER_M

  const imageCredits =
    usage.images.low    * IMAGE_CREDITS.low +
    usage.images.medium * IMAGE_CREDITS.medium +
    usage.images.high   * IMAGE_CREDITS.high

  return Math.max(1, Math.ceil(textCredits + imageCredits))
}

export async function POST(req: NextRequest) {
  // Verify internal secret
  const secret = process.env.COOVEX_INTERNAL_SECRET
  if (!secret || req.headers.get('x-internal-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json() as {
      api_key: string
      site_url: string
      usage: {
        inputTokens:  number
        outputTokens: number
        images: { low: number; medium: number; high: number }
      }
    }

    const { api_key, usage } = body
    if (!api_key || !usage) {
      return NextResponse.json({ error: 'api_key and usage required' }, { status: 400 })
    }

    const service = createServiceClient()

    // Resolve workspace from api_key
    const { data: business } = await service
      .from('businesses')
      .select('workspace_id')
      .eq('api_key', api_key)
      .maybeSingle()

    if (!business) {
      return NextResponse.json({ error: 'Invalid api_key' }, { status: 401 })
    }

    const credits = calculateCredits(usage)

    const desc = `WP Agent — ${usage.inputTokens.toLocaleString()} in / ${usage.outputTokens.toLocaleString()} out tokens` +
      (usage.images.low + usage.images.medium + usage.images.high > 0
        ? ` + ${usage.images.low + usage.images.medium + usage.images.high} image(s)`
        : '')

    const result = await deductCreditsAmount(business.workspace_id, credits, desc)

    return NextResponse.json({
      ok:            result.ok,
      credits_used:  credits,
      balance_after: result.balance,
      breakdown: {
        input_tokens:  usage.inputTokens,
        output_tokens: usage.outputTokens,
        images:        usage.images,
      },
    })
  } catch (err) {
    console.error('POST /api/wp-dev/usage error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
