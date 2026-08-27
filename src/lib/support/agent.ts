import Anthropic from '@anthropic-ai/sdk'
import { Client as SshClient } from 'ssh2'

export interface AgentIntegration {
  id: string
  type: 'supabase' | 'github' | 'wordpress' | 'mysql_bridge' | 'custom_api' | 'ssh_vps' | 'postgres'
  label: string
  base_url: string
  api_key?: string
  github_repo?: string
  wp_username?: string
  wp_app_password?: string
  // SSH fields
  ssh_host?: string
  ssh_port?: number
  ssh_username?: string
  ssh_private_key?: string
  ssh_password?: string
  // Postgres fields
  pg_host?: string
  pg_port?: number
  pg_database?: string
  pg_user?: string
  pg_password?: string
  pg_ssl?: boolean
}

interface ConvMessage {
  sender_type: string
  sender_name: string | null
  content: string
  created_at: string
}

interface AgentOptions {
  conversationId: string
  propertyName: string
  propertyDomain: string | null
  systemPrompt?: string | null
  integrations: AgentIntegration[]
  messages: ConvMessage[]
  customerName?: string | null
  customerEmail?: string | null
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildSystemPrompt(opts: AgentOptions): string {
  const { propertyName, propertyDomain, systemPrompt, integrations } = opts

  let integrationsDoc = ''
  for (const int of integrations) {
    integrationsDoc += `\n\n### ${int.label} (${int.type})`
    if (int.type === 'supabase') {
      integrationsDoc += `
Base URL: ${int.base_url}
Auth: Authorization: Bearer ${int.api_key}
apikey: ${int.api_key}
Example — check user subscription:
  GET ${int.base_url}/rest/v1/subscriptions?email=eq.CUSTOMER_EMAIL&select=plan,status,expires_at
  Headers: { apikey: "KEY", Authorization: "Bearer KEY", Prefer: "return=representation" }`
    } else if (int.type === 'github') {
      integrationsDoc += `
Base URL: https://api.github.com
Auth: Authorization: Bearer ${int.api_key}
Default Repo: ${int.github_repo || 'not set'}
Example — create issue:
  POST https://api.github.com/repos/${int.github_repo || 'ORG/REPO'}/issues
  Body: { "title": "Bug: ...", "body": "Customer report: ..." }`
    } else if (int.type === 'wordpress') {
      const auth = int.wp_username && int.wp_app_password
        ? Buffer.from(`${int.wp_username}:${int.wp_app_password}`).toString('base64')
        : 'BASE64_ENCODED'
      integrationsDoc += `
Base URL: ${int.base_url}/wp-json/wp/v2
Auth: Authorization: Basic ${auth}
Example — find user:
  GET ${int.base_url}/wp-json/wp/v2/users?search=CUSTOMER_EMAIL
Example — WooCommerce subscription:
  GET ${int.base_url}/wp-json/wc/v3/subscriptions?customer_email=CUSTOMER_EMAIL`
    } else if (int.type === 'mysql_bridge') {
      integrationsDoc += `
Bridge URL: ${int.base_url}
Auth: X-Bridge-Key: ${int.api_key}
Example — check subscription:
  POST ${int.base_url}
  Headers: { X-Bridge-Key: "KEY", Content-Type: "application/json" }
  Body: { "sql": "SELECT * FROM subscriptions WHERE email = 'CUSTOMER_EMAIL' LIMIT 1" }`
    } else if (int.type === 'custom_api') {
      integrationsDoc += `
Base URL: ${int.base_url}
Auth: Authorization: Bearer ${int.api_key}
Use http_get or http_post to call any endpoint.`
    } else if (int.type === 'postgres') {
      integrationsDoc += `
Host: ${int.pg_host}:${int.pg_port || 5432}  Database: ${int.pg_database}
Use query_postgres(sql) to run SELECT queries.
Example:
  query_postgres("SELECT plan, status, expires_at FROM subscriptions WHERE email = 'customer@email.com'")`
    } else if (int.type === 'ssh_vps') {
      integrationsDoc += `
Host: ${int.ssh_host}:${int.ssh_port || 22}
User: ${int.ssh_username}
Use ssh_exec(command) to run commands on this server.
Examples:
  ssh_exec("systemctl status nginx")
  ssh_exec("systemctl restart php8.1-fpm")
  ssh_exec("tail -50 /var/log/nginx/error.log")
  ssh_exec("df -h")
  ssh_exec("pm2 status")
  ssh_exec("mysql -u root -pPASS -e 'SHOW DATABASES;'")
IMPORTANT: Only run safe diagnostic/fix commands. Never delete files or data.`
    }
  }

  return `You are an AI customer support agent for ${propertyName}${propertyDomain ? ` (${propertyDomain})` : ''}.

${systemPrompt ? `Custom instructions:\n${systemPrompt}\n` : ''}
Your job:
1. Read the customer's message carefully
2. Use available integrations to investigate (check subscription, account status, etc.)
3. Solve the issue if possible (create tickets, reset things, etc.)
4. Send a clear, helpful reply using send_reply

Rules:
- Always call send_reply at the end — never leave without replying
- Be concise and professional
- Reply in the same language the customer used
- If you can't solve it, explain what you found and what next steps are
- Do NOT reveal API keys or internal system details to the customer
${integrationsDoc ? `\nAvailable integrations:${integrationsDoc}` : '\nNo integrations configured — reply based on conversation context only.'}`
}

const BLOCKED_COMMANDS = /\b(rm\s+-[rRf]{1,3}f?|mkfs|dd\s+if=\/dev|wget[^|]*\|[^|]*bash|curl[^|]*\|[^|]*bash|chmod\s+000|DROP\s+TABLE|TRUNCATE\s+TABLE|> \/dev\/sd)\b/i

async function execSsh(integration: AgentIntegration, command: string): Promise<string> {
  if (BLOCKED_COMMANDS.test(command)) {
    return JSON.stringify({ error: 'Command blocked for safety. Use safe diagnostic commands only.' })
  }

  return new Promise((resolve) => {
    const conn = new SshClient()
    let output = ''
    const done = (result: string) => { try { conn.end() } catch {} resolve(result) }
    const timer = setTimeout(() => done(JSON.stringify({ error: 'SSH timeout after 15s' })), 15000)

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { clearTimeout(timer); done(JSON.stringify({ error: err.message })); return }
        stream.on('data', (d: Buffer) => { output += d.toString() })
        stream.stderr.on('data', (d: Buffer) => { output += '[stderr] ' + d.toString() })
        stream.on('close', () => { clearTimeout(timer); done(output.trim().slice(0, 3000)) })
      })
    })

    conn.on('error', (err) => { clearTimeout(timer); done(JSON.stringify({ error: err.message })) })

    conn.connect({
      host:       integration.ssh_host || '',
      port:       integration.ssh_port || 22,
      username:   integration.ssh_username || 'root',
      ...(integration.ssh_private_key
        ? { privateKey: integration.ssh_private_key }
        : { password: integration.ssh_password || '' }),
      readyTimeout: 10000,
    })
  })
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'send_reply',
    description: 'Send the final reply to the customer. Call this once you have a complete response ready.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'The reply message to send to the customer' },
      },
      required: ['message'],
    },
  },
  {
    name: 'http_get',
    description: 'Make a GET request to fetch data from an integration (Supabase, GitHub, WordPress, custom API).',
    input_schema: {
      type: 'object' as const,
      properties: {
        url:     { type: 'string', description: 'Full URL to request' },
        headers: { type: 'object', description: 'HTTP headers as key-value pairs', additionalProperties: { type: 'string' } },
      },
      required: ['url'],
    },
  },
  {
    name: 'http_post',
    description: 'Make a POST request to an integration (create GitHub issue, query MySQL bridge, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {
        url:     { type: 'string', description: 'Full URL to request' },
        body:    { type: 'object', description: 'Request body as JSON object' },
        headers: { type: 'object', description: 'HTTP headers as key-value pairs', additionalProperties: { type: 'string' } },
      },
      required: ['url', 'body'],
    },
  },
  {
    name: 'ssh_exec',
    description: 'Run a shell command on the configured VPS via SSH. Use for checking service status, restarting services, reading logs, disk usage, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Shell command to execute on the remote server' },
      },
      required: ['command'],
    },
  },
  {
    name: 'query_postgres',
    description: 'Run a SELECT query on a configured PostgreSQL database.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sql: { type: 'string', description: 'SQL SELECT query to run' },
      },
      required: ['sql'],
    },
  },
]

async function execTool(name: string, input: Record<string, unknown>, integrations: AgentIntegration[]): Promise<string> {
  if (name === 'http_get') {
    try {
      const res = await fetch(input.url as string, {
        headers: (input.headers as Record<string, string>) || {},
      })
      const text = await res.text()
      return text.slice(0, 4000) // cap to avoid huge responses
    } catch (e) {
      return JSON.stringify({ error: String(e) })
    }
  }

  if (name === 'http_post') {
    try {
      const res = await fetch(input.url as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...((input.headers as Record<string, string>) || {}),
        },
        body: JSON.stringify(input.body),
      })
      const text = await res.text()
      return text.slice(0, 4000)
    } catch (e) {
      return JSON.stringify({ error: String(e) })
    }
  }

  if (name === 'ssh_exec') {
    const sshInt = integrations.find(i => i.type === 'ssh_vps')
    if (!sshInt) return JSON.stringify({ error: 'No SSH/VPS integration configured' })
    return await execSsh(sshInt, input.command as string)
  }

  if (name === 'query_postgres') {
    const pgInt = integrations.find(i => i.type === 'postgres')
    if (!pgInt) return JSON.stringify({ error: 'No PostgreSQL integration configured' })
    const sql = (input.sql as string).trim()
    if (!/^\s*SELECT/i.test(sql)) return JSON.stringify({ error: 'Only SELECT queries allowed' })
    try {
      const { Client } = await import('pg')
      const client = new Client({
        host:     pgInt.pg_host || 'localhost',
        port:     pgInt.pg_port || 5432,
        database: pgInt.pg_database,
        user:     pgInt.pg_user,
        password: pgInt.pg_password,
        ssl:      pgInt.pg_ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 8000,
      })
      await client.connect()
      const res = await client.query(sql)
      await client.end()
      return JSON.stringify({ rows: res.rows.slice(0, 50) })
    } catch (e) {
      return JSON.stringify({ error: String(e) })
    }
  }

  return JSON.stringify({ error: 'Unknown tool' })
}

export async function runSupportAgent(opts: AgentOptions): Promise<string> {
  const systemMsg = buildSystemPrompt(opts)

  const history = opts.messages
    .slice(-12)
    .map(m => {
      const role = m.sender_type === 'customer' ? 'Customer' : 'Support'
      return `[${role}${m.sender_name ? ` (${m.sender_name})` : ''}]: ${m.content}`
    })
    .join('\n\n')

  const userContent = `Customer${opts.customerName ? ` (${opts.customerName})` : ''}${opts.customerEmail ? ` <${opts.customerEmail}>` : ''} sent:

${history}

Investigate and reply to the customer's latest message.`

  const msgs: Anthropic.MessageParam[] = [{ role: 'user', content: userContent }]

  let finalReply = ''
  const MAX_ITER = 8

  for (let i = 0; i < MAX_ITER; i++) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemMsg,
      tools: TOOLS,
      messages: msgs,
    })

    // Collect text blocks as fallback
    const textBlocks = response.content.filter(b => b.type === 'text') as Anthropic.TextBlock[]
    if (textBlocks.length) finalReply = textBlocks.map(b => b.text).join('\n')

    if (response.stop_reason === 'end_turn') break

    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
    if (!toolUseBlocks.length) break

    // Check for send_reply
    const replyTool = toolUseBlocks.find(b => b.name === 'send_reply')
    if (replyTool) {
      finalReply = (replyTool.input as { message: string }).message
      break
    }

    // Execute other tools
    msgs.push({ role: 'assistant', content: response.content })
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tool of toolUseBlocks) {
      const result = await execTool(tool.name, tool.input as Record<string, unknown>, opts.integrations)
      toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: result })
    }
    msgs.push({ role: 'user', content: toolResults })
  }

  return finalReply || 'I have reviewed your message and our team will follow up shortly.'
}
