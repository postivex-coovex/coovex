import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testWebsiteIntegration, isWebsitePublisher } from '@/lib/publishing'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, settings } = await request.json()

  try {
    // Website publishing integrations (WordPress, Ghost, GitHub, Webhook, SFTP)
    if (isWebsitePublisher(platform)) {
      const result = await testWebsiteIntegration(platform, settings)
      return NextResponse.json(result)
    }

    switch (platform) {
      case 'hubspot': {
        const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
          headers: { Authorization: `Bearer ${settings.api_key}`, 'Content-Type': 'application/json' },
        })
        if (!res.ok) return NextResponse.json({ ok: false, msg: 'Invalid HubSpot API key' })
        return NextResponse.json({ ok: true, msg: 'HubSpot connection successful' })
      }

      case 'mailchimp': {
        const dc = (settings.api_key as string).split('-').pop()
        const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/ping`, {
          headers: { Authorization: `Basic ${Buffer.from(`anystring:${settings.api_key}`).toString('base64')}` },
        })
        if (!res.ok) return NextResponse.json({ ok: false, msg: 'Invalid Mailchimp API key' })
        return NextResponse.json({ ok: true, msg: 'Mailchimp connection successful' })
      }

      case 'zapier': {
        const res = await fetch(settings.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'test', source: 'coovex', timestamp: new Date().toISOString() }),
        })
        if (!res.ok) return NextResponse.json({ ok: false, msg: 'Webhook URL not reachable' })
        return NextResponse.json({ ok: true, msg: 'Test event sent to Zapier' })
      }

      case 'ga4': {
        if (!settings.measurement_id?.startsWith('G-')) {
          return NextResponse.json({ ok: false, msg: 'Measurement ID must start with G-' })
        }
        return NextResponse.json({ ok: true, msg: 'GA4 Measurement ID saved. It will be injected on next page load.' })
      }

      case 'google_ads': {
        if (!settings.tag_id?.startsWith('AW-')) {
          return NextResponse.json({ ok: false, msg: 'Tag ID must start with AW-' })
        }
        return NextResponse.json({ ok: true, msg: 'Google Ads tag saved. Conversion tracking active.' })
      }

      default:
        return NextResponse.json({ ok: false, msg: 'Unknown platform' })
    }
  } catch {
    return NextResponse.json({ ok: false, msg: 'Connection test failed' })
  }
}
