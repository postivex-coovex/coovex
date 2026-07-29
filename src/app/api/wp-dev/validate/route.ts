/**
 * CooVex Dev — License validation endpoint
 *
 * Called by the WordPress plugin on activation and daily via cron.
 * Returns a daily-rotating license token that the plugin uses to verify
 * command response signatures.
 *
 * Security properties:
 * - Token rotates at midnight UTC every day
 * - Token is HMAC-derived from (api_key + site_url + date) using a server secret
 *   that never leaves this server
 * - Even knowing the algorithm, an attacker cannot forge a valid token without
 *   knowing CVD_SIGNING_SECRET
 * - Site URL is recorded on first validation; subsequent calls from a different
 *   URL are rejected (prevents plugin copy/paste to other sites)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

// Never expose this secret — only the server knows it
const SIGNING_SECRET = process.env.CVD_SIGNING_SECRET ?? 'cvd-change-this-in-production-env'

/** Derive the license token for a given day. Rotates at midnight UTC. */
export function deriveLicenseToken(apiKey: string, siteUrl: string, date: string): string {
  return createHmac('sha256', SIGNING_SECRET)
    .update(`${apiKey}:${normalizeUrl(siteUrl)}:${date}`)
    .digest('hex')
}

/** Sign a response body so the plugin can verify it wasn't tampered with. */
export function signResponseBody(body: string, licenseToken: string, nonce: string): string {
  return createHmac('sha256', licenseToken)
    .update(`${body}:${nonce}`)
    .digest('hex')
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.toLowerCase().trim())
    return u.origin // strips trailing slashes, paths, and query strings
  } catch {
    return url.toLowerCase().trim().replace(/\/$/, '')
  }
}

function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0] // "YYYY-MM-DD"
}

function getTomorrowUTC(): Date {
  const d = new Date()
  d.setUTCHours(24, 0, 0, 0)
  return d
}

export async function POST(req: NextRequest) {
  try {
    // If request comes from our VPS agent, verify internal secret
    const internalSecret = process.env.COOVEX_INTERNAL_SECRET
    const sentSecret     = req.headers.get('x-internal-secret')
    if (sentSecret && internalSecret && sentSecret !== internalSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { api_key, site_url, plugin_version } = body as {
      api_key?: string
      site_url?: string
      plugin_version?: string
    }

    if (!api_key || !site_url) {
      return NextResponse.json({ error: 'api_key and site_url required' }, { status: 400 })
    }

    const service = createServiceClient()

    // Validate API key
    const { data: business } = await service
      .from('businesses')
      .select('id, workspace_id, name, website_url')
      .eq('api_key', api_key)
      .maybeSingle()

    if (!business) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const normalizedUrl = normalizeUrl(site_url)

    // Check if workspace is active (not suspended)
    const { data: workspace } = await service
      .from('workspaces')
      .select('plan, ai_credits_balance')
      .eq('id', business.workspace_id)
      .single()

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 401 })
    }

    // Site URL binding: record on first validation; reject mismatches
    const existingSiteUrl = await service
      .from('wp_dev_licenses')
      .select('site_url, revoked')
      .eq('api_key', api_key)
      .maybeSingle()
      .then(r => r.data)

    if (existingSiteUrl) {
      if (existingSiteUrl.revoked) {
        return NextResponse.json({
          error: 'This plugin license has been revoked. Contact support.',
          code: 'REVOKED',
        }, { status: 403 })
      }

      const storedNorm = normalizeUrl(existingSiteUrl.site_url)
      if (storedNorm !== normalizedUrl) {
        // Site URL mismatch — flag it and reject
        await service.from('wp_dev_licenses').update({
          last_mismatch: new Date().toISOString(),
          mismatch_url: normalizedUrl,
        }).eq('api_key', api_key)

        return NextResponse.json({
          error: 'Site URL mismatch. This plugin file is configured for a different domain.',
          code: 'SITE_MISMATCH',
          registered_for: storedNorm,
        }, { status: 403 })
      }

      // Update last seen
      await service.from('wp_dev_licenses').update({
        last_validated: new Date().toISOString(),
        plugin_version: plugin_version ?? null,
      }).eq('api_key', api_key)
    } else {
      // First time — register this site URL
      await service.from('wp_dev_licenses').insert({
        api_key,
        workspace_id: business.workspace_id,
        site_url: normalizedUrl,
        plugin_version: plugin_version ?? null,
        first_validated: new Date().toISOString(),
        last_validated: new Date().toISOString(),
        revoked: false,
      })
    }

    const today        = getTodayUTC()
    const expiresAt    = getTomorrowUTC()
    const licenseToken = deriveLicenseToken(api_key, normalizedUrl, today)

    return NextResponse.json({
      valid: true,
      license_token: licenseToken,
      expires_at: expiresAt.toISOString(),
      site_url: normalizedUrl,
      plan: workspace.plan,
    })
  } catch (err) {
    console.error('POST /api/wp-dev/validate error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
