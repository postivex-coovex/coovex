// Zoom Server-to-Server OAuth: creates meetings on the host's own Zoom account.
// Credentials come from meeting_settings (account id / client id / client secret).

export interface ZoomCreds {
  zoom_account_id: string | null
  zoom_client_id: string | null
  zoom_client_secret: string | null
}

export interface ZoomMeeting {
  id: string
  join_url: string
  password?: string
}

export function hasZoom(c: Partial<ZoomCreds> | null | undefined): c is ZoomCreds {
  return !!(c?.zoom_account_id && c.zoom_client_id && c.zoom_client_secret)
}

async function getToken(c: ZoomCreds): Promise<string> {
  const basic = Buffer.from(`${c.zoom_client_id}:${c.zoom_client_secret}`).toString('base64')
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(c.zoom_account_id!)}`,
    { method: 'POST', headers: { Authorization: `Basic ${basic}` } },
  )
  const json = await res.json().catch(() => ({})) as { access_token?: string; reason?: string; error?: string }
  if (!res.ok || !json.access_token) {
    throw new Error(`Zoom auth failed: ${json.reason || json.error || res.status}`)
  }
  return json.access_token
}

export async function createZoomMeeting(
  c: ZoomCreds,
  opts: { topic: string; startIso: string; durationMin: number; agenda?: string },
): Promise<ZoomMeeting> {
  const token = await getToken(c)
  const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: opts.topic.slice(0, 200),
      type: 2,
      start_time: new Date(opts.startIso).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      duration: opts.durationMin,
      timezone: 'UTC',
      agenda: opts.agenda?.slice(0, 2000),
      settings: { join_before_host: true, waiting_room: false, mute_upon_entry: false },
    }),
  })
  const json = await res.json().catch(() => ({})) as { id?: number; join_url?: string; password?: string; message?: string }
  if (!res.ok || !json.join_url || !json.id) throw new Error(`Zoom create failed: ${json.message || res.status}`)
  return { id: String(json.id), join_url: json.join_url, password: json.password }
}

export async function updateZoomMeeting(
  c: ZoomCreds,
  meetingId: string,
  opts: { startIso: string; durationMin: number },
): Promise<void> {
  const token = await getToken(c)
  const res = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_time: new Date(opts.startIso).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      duration: opts.durationMin,
      timezone: 'UTC',
    }),
  })
  if (!res.ok) throw new Error(`Zoom update failed: ${res.status}`)
}

export async function deleteZoomMeeting(c: ZoomCreds, meetingId: string): Promise<void> {
  const token = await getToken(c)
  await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** Verifies credentials by requesting a token. */
export async function testZoom(c: ZoomCreds): Promise<void> {
  await getToken(c)
}
