import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildZip } from '@/lib/zip'
import { COOVEX_DEV_PHP } from '../plugin/route'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const api_key = searchParams.get('api_key') ?? ''

  if (!api_key) {
    return NextResponse.json({ error: 'api_key required' }, { status: 400 })
  }

  // Validate the API key — must belong to a real workspace
  const service = createServiceClient()
  const { data: business } = await service
    .from('businesses')
    .select('id, workspace_id')
    .eq('api_key', api_key)
    .maybeSingle()

  if (!business) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  // Check the license is not revoked
  const { data: license } = await service
    .from('wp_dev_licenses')
    .select('revoked')
    .eq('api_key', api_key)
    .maybeSingle()

  if (license?.revoked) {
    return NextResponse.json({ error: 'License revoked' }, { status: 403 })
  }

  // Build ZIP: coovex-dev/coovex-dev.php
  // The API key is NOT embedded here — it's already stored in WP options and
  // survives the update. Embedding it would require the user to be logged in
  // during auto-update (impossible for background WP updates).
  const phpContent = Buffer.from(COOVEX_DEV_PHP, 'utf8')
  const zip = buildZip([
    { name: 'coovex-dev/coovex-dev.php', data: phpContent },
  ])

  return new Response(zip, {
    status: 200,
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': 'attachment; filename="coovex-dev.zip"',
      'Content-Length':      String(zip.length),
      'Cache-Control':       'no-store, no-cache, private',
    },
  })
}
