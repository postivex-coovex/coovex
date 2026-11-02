import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authUser } from '@/lib/meetings/ops'
import { db, RESERVED_SLUGS, slugify } from '@/lib/meetings/service'
import { isValidTimeZone } from '@/lib/meetings/tz'
import type { MeetingSettings } from '@/lib/meetings/types'

const MASK = '••••••••'

function present(s: MeetingSettings) {
  return {
    slug: s.slug,
    display_name: s.display_name,
    bio: s.bio,
    timezone: s.timezone,
    host_email: s.host_email,
    brand_color: s.brand_color,
    zoom_account_id: s.zoom_account_id,
    zoom_client_id: s.zoom_client_id,
    zoom_client_secret: s.zoom_client_secret ? MASK : '',
    zoom_connected: !!(s.zoom_account_id && s.zoom_client_id && s.zoom_client_secret),
  }
}

export async function GET() {
  const auth = await authUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase, user } = auth

  const { data: existing } = await supabase.from('meeting_settings').select('*').eq('user_id', user.id).maybeSingle()
  if (existing) return NextResponse.json({ settings: present(existing as MeetingSettings), is_new: false })

  // First visit: create a profile with a unique public slug
  const { data: profile } = await supabase.from('profiles').select('name, email').eq('id', user.id).maybeSingle()
  const seed = slugify(profile?.name || (profile?.email || user.email || 'host').split('@')[0]) || 'host'
  const admin = db()
  let slug = seed.length >= 3 ? seed : `${seed}-meet`
  for (let i = 0; i < 6; i++) {
    const { data: taken } = await admin.from('meeting_settings').select('user_id').eq('slug', slug).maybeSingle()
    if (!taken && !RESERVED_SLUGS.has(slug)) break
    slug = `${seed}-${Math.random().toString(36).slice(2, 6)}`
  }

  const { data: created, error } = await supabase.from('meeting_settings').insert({
    user_id: user.id,
    slug,
    display_name: profile?.name || null,
    host_email: profile?.email || user.email || null,
  }).select('*').single()
  if (error || !created) return NextResponse.json({ error: error?.message || 'Could not create settings' }, { status: 500 })

  // Sensible defaults: Mon–Fri 9–5 and one starter meeting type
  await supabase.from('meeting_availability').insert(
    [1, 2, 3, 4, 5].map(weekday => ({ user_id: user.id, weekday, start_minute: 540, end_minute: 1020 })),
  )
  await supabase.from('meeting_event_types').insert({
    user_id: user.id, slug: '30-min-call', title: '30 Minute Call', description: 'A quick call to talk things through.',
    duration_min: 30, location_type: 'custom_link', location_value: '', requires_confirmation: true,
  })
  return NextResponse.json({ settings: present(created as MeetingSettings), is_new: true })
}

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/, 'Link name must be 3–40 characters: lowercase letters, numbers, dashes').nullish(),
  display_name: z.string().trim().max(80).nullish(),
  bio: z.string().trim().max(500).nullish(),
  timezone: z.string().nullish(),
  host_email: z.union([z.literal(''), z.string().email('Enter a valid notification email')]).nullish(),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #2563eb').nullish(),
  zoom_account_id: z.string().trim().max(120).nullish(),
  zoom_client_id: z.string().trim().max(120).nullish(),
  zoom_client_secret: z.string().trim().max(200).nullish(),
})

export async function PUT(req: NextRequest) {
  const auth = await authUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase, user } = auth

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const b = parsed.data

  if (b.timezone && !isValidTimeZone(b.timezone)) {
    return NextResponse.json({ error: 'Unknown timezone' }, { status: 400 })
  }
  if (b.slug) {
    if (RESERVED_SLUGS.has(b.slug)) return NextResponse.json({ error: 'That link name is reserved' }, { status: 400 })
    const { data: taken } = await db().from('meeting_settings').select('user_id').eq('slug', b.slug).neq('user_id', user.id).maybeSingle()
    if (taken) return NextResponse.json({ error: 'That link name is already taken' }, { status: 409 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['slug', 'display_name', 'bio', 'timezone', 'host_email', 'brand_color', 'zoom_account_id', 'zoom_client_id'] as const) {
    if (b[k] === undefined) continue
    // slug, timezone and brand color are NOT NULL columns: ignore empty values
    if ((k === 'slug' || k === 'timezone' || k === 'brand_color') && !b[k]) continue
    update[k] = b[k] === '' ? null : b[k]
  }
  // Never overwrite the stored secret with the display mask
  if (b.zoom_client_secret != null && b.zoom_client_secret !== MASK) {
    update.zoom_client_secret = b.zoom_client_secret === '' ? null : b.zoom_client_secret
  }

  const { data, error } = await supabase.from('meeting_settings').update(update).eq('user_id', user.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: present(data as MeetingSettings) })
}
