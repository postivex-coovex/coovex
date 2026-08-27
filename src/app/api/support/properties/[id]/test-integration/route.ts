import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { AgentIntegration } from '@/lib/support/agent'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const integration: AgentIntegration = await req.json()

  try {
    if (integration.type === 'ssh_vps') {
      const { Client } = await import('ssh2')
      const result = await new Promise<string>((resolve) => {
        const conn = new Client()
        const timer = setTimeout(() => { try { conn.end() } catch {} resolve('timeout') }, 12000)
        conn.on('ready', () => {
          conn.exec('echo ok', (err, stream) => {
            clearTimeout(timer)
            if (err) { conn.end(); resolve('exec_error:' + err.message); return }
            let out = ''
            stream.on('data', (d: Buffer) => { out += d.toString() })
            stream.on('close', () => { conn.end(); resolve(out.trim()) })
          })
        })
        conn.on('error', (err) => { clearTimeout(timer); resolve('error:' + err.message) })
        conn.connect({
          host: integration.ssh_host || '',
          port: integration.ssh_port || 22,
          username: integration.ssh_username || 'root',
          ...(integration.ssh_private_key
            ? { privateKey: integration.ssh_private_key }
            : { password: integration.ssh_password || '' }),
          readyTimeout: 10000,
        })
      })
      if (result === 'ok') return NextResponse.json({ ok: true, message: 'SSH connection successful' })
      if (result === 'timeout') return NextResponse.json({ ok: false, message: 'Connection timed out after 12s' }, { status: 400 })
      return NextResponse.json({ ok: false, message: result }, { status: 400 })
    }

    if (integration.type === 'postgres') {
      const { Client } = await import('pg')
      const client = new Client({
        host:     integration.pg_host || 'localhost',
        port:     integration.pg_port || 5432,
        database: integration.pg_database,
        user:     integration.pg_user,
        password: integration.pg_password,
        ssl:      integration.pg_ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 8000,
      })
      await client.connect()
      const res = await client.query('SELECT version()')
      await client.end()
      const ver = (res.rows[0]?.version as string || '').split(' ').slice(0, 2).join(' ')
      return NextResponse.json({ ok: true, message: `Connected — ${ver}` })
    }

    if (integration.type === 'supabase') {
      const res = await fetch(`${integration.base_url}/rest/v1/`, {
        headers: { apikey: integration.api_key || '', Authorization: `Bearer ${integration.api_key}` },
      })
      if (res.ok || res.status === 200) return NextResponse.json({ ok: true, message: 'Supabase connection successful' })
      return NextResponse.json({ ok: false, message: `HTTP ${res.status}` }, { status: 400 })
    }

    if (integration.type === 'github') {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${integration.api_key}`, 'User-Agent': 'CooVex-Agent' },
      })
      if (res.ok) {
        const data = await res.json() as { login: string }
        return NextResponse.json({ ok: true, message: `GitHub authenticated as @${data.login}` })
      }
      return NextResponse.json({ ok: false, message: `HTTP ${res.status}` }, { status: 400 })
    }

    if (integration.type === 'wordpress') {
      const auth = integration.wp_username && integration.wp_app_password
        ? Buffer.from(`${integration.wp_username}:${integration.wp_app_password}`).toString('base64')
        : null
      const res = await fetch(`${integration.base_url}/wp-json/wp/v2/users/me`, {
        headers: auth ? { Authorization: `Basic ${auth}` } : {},
      })
      if (res.ok) {
        const data = await res.json() as { name: string }
        return NextResponse.json({ ok: true, message: `WordPress connected as ${data.name}` })
      }
      return NextResponse.json({ ok: false, message: `HTTP ${res.status} — check URL and credentials` }, { status: 400 })
    }

    if (integration.type === 'mysql_bridge') {
      const res = await fetch(integration.base_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Bridge-Key': integration.api_key || '' },
        body: JSON.stringify({ sql: 'SELECT 1 AS ok' }),
      })
      if (res.ok) return NextResponse.json({ ok: true, message: 'MySQL Bridge reachable' })
      return NextResponse.json({ ok: false, message: `HTTP ${res.status}` }, { status: 400 })
    }

    if (integration.type === 'custom_api') {
      const res = await fetch(integration.base_url, {
        headers: { Authorization: `Bearer ${integration.api_key}` },
      })
      return NextResponse.json({ ok: res.ok, message: `HTTP ${res.status}` }, { status: res.ok ? 200 : 400 })
    }

    return NextResponse.json({ ok: false, message: 'Unknown integration type' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, message: String(e) }, { status: 400 })
  }
}
