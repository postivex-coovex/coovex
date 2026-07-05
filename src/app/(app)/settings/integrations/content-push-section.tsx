'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, RefreshCw, Eye, EyeOff, Zap, Globe, Code2, ChevronDown, ChevronUp } from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors whitespace-nowrap"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : (label ?? 'Copy')}
    </button>
  )
}

function CodeBlock({ code, lang = 'code' }: { code: string; lang?: string }) {
  return (
    <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/80">
        <span className="text-[11px] font-mono text-slate-500">{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  )
}

// ─── Platform Code Snippets ───────────────────────────────────────────────────

const PHP_CODE = `<?php
// coovex-receiver.php — place anywhere on your server/hosting
// Set your Webhook URL to: https://yoursite.com/coovex-receiver.php

define('COOVEX_SECRET', 'your_webhook_secret_here'); // or leave '' to skip

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['error' => 'Method not allowed']));
}

$body = file_get_contents('php://input');
$data = json_decode($body, true);

// ── 1. Verify HMAC signature ────────────────────────────────────────────────
if (COOVEX_SECRET !== '') {
    $sig      = $_SERVER['HTTP_X_COOVEX_SIGNATURE'] ?? '';
    $expected = 'sha256=' . hash_hmac('sha256', $body, COOVEX_SECRET);
    if (!hash_equals($expected, $sig)) {
        http_response_code(401);
        exit(json_encode(['error' => 'Invalid signature']));
    }
}

// ── 2. Save content to your database / files ────────────────────────────────
$title       = htmlspecialchars($data['title'] ?? 'New Post');
$content     = $data['content'] ?? '';
$channel     = $data['channel'] ?? 'blog';
$confirm_url = $data['confirm_url'];
$api_key     = $data['api_key'];

// Example: save to a MySQL database
$pdo  = new PDO('mysql:host=localhost;dbname=yourdb', 'user', 'pass');
$stmt = $pdo->prepare(
    'INSERT INTO blog_posts (title, content, channel, published_at) VALUES (?, ?, ?, NOW())'
);
$stmt->execute([$title, $content, $channel]);
$post_id = $pdo->lastInsertId();

$slug         = strtolower(preg_replace('/[^a-z0-9]+/', '-', $title));
$published_url = 'https://yoursite.com/blog/' . $slug;

// ── 3. Confirm back to CooVex ───────────────────────────────────────────────
$payload = json_encode([
    'api_key'      => $api_key,
    'external_url' => $published_url,
    'published_at' => date('c'),
]);

$ch = curl_init($confirm_url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
]);
curl_exec($ch);
curl_close($ch);

// ── 4. Respond OK ───────────────────────────────────────────────────────────
echo json_encode(['ok' => true, 'post_id' => $post_id, 'url' => $published_url]);
`

const WORDPRESS_PLUGIN = `<?php
/**
 * Plugin Name: CooVex Content Push
 * Description: Auto-publishes CooVex AI content as WordPress posts
 * Version: 1.0.0
 */

// Settings page
add_action('admin_menu', function() {
    add_options_page('CooVex Push', 'CooVex Push', 'manage_options', 'coovex', function() {
        if ($_POST) update_option('coovex_secret', sanitize_text_field($_POST['secret'] ?? ''));
        $s = get_option('coovex_secret', '');
        echo '<div class="wrap"><h1>CooVex Push Settings</h1><form method="post">
            <table class="form-table"><tr><th>Webhook Secret</th>
            <td><input type="text" name="secret" value="' . esc_attr($s) . '" class="regular-text"></td></tr>
            </table><p><b>Webhook URL:</b> <code>' . rest_url('coovex/v1/receive') . '</code></p>
            <p class="submit"><input type="submit" class="button-primary" value="Save"></p>
        </form></div>';
    });
});

// REST endpoint
add_action('rest_api_init', function() {
    register_rest_route('coovex/v1', '/receive', [
        'methods'             => 'POST',
        'callback'            => function(WP_REST_Request $req) {
            $secret = get_option('coovex_secret');
            if ($secret) {
                $sig = $req->get_header('X-CooVex-Signature');
                $exp = 'sha256=' . hash_hmac('sha256', $req->get_body(), $secret);
                if (!hash_equals($exp, $sig ?? ''))
                    return new WP_Error('unauthorized', 'Bad signature', ['status' => 401]);
            }

            $d = $req->get_json_params();
            $id = wp_insert_post([
                'post_title'   => sanitize_text_field($d['title'] ?? 'Post'),
                'post_content' => wp_kses_post($d['content'] ?? ''),
                'post_status'  => 'publish',
            ]);
            if (is_wp_error($id)) return $id;

            $url = get_permalink($id);
            wp_remote_post($d['confirm_url'], [
                'body'    => json_encode(['api_key' => $d['api_key'], 'external_url' => $url, 'published_at' => current_time('c')]),
                'headers' => ['Content-Type' => 'application/json'],
            ]);

            return ['ok' => true, 'wp_post_id' => $id, 'url' => $url];
        },
        'permission_callback' => '__return_true',
    ]);
});
`

const NODE_CODE = `// server.js — Node.js / Express
// npm install express

import express from 'express'
import crypto from 'crypto'

const app = express()
const SECRET = process.env.COOVEX_SECRET || ''

// Capture raw body for HMAC verification
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf }
}))

app.post('/coovex/receive', async (req, res) => {
  // ── 1. Verify signature ──────────────────────────────────────────────────
  if (SECRET) {
    const sig = req.headers['x-coovex-signature']
    const expected = 'sha256=' + crypto
      .createHmac('sha256', SECRET).update(req.rawBody).digest('hex')
    if (sig !== expected) return res.status(401).json({ error: 'Bad signature' })
  }

  const { title, content, channel, confirm_url, api_key } = req.body

  // ── 2. Publish to your CMS ───────────────────────────────────────────────
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)
  const publishedUrl = \`https://yoursite.com/blog/\${slug}\`

  // TODO: insert into your DB, call Ghost API, Contentful, etc.
  // await db.posts.create({ title, content, slug, channel })

  // ── 3. Confirm back to CooVex ────────────────────────────────────────────
  await fetch(confirm_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key,
      external_url: publishedUrl,
      published_at: new Date().toISOString(),
    }),
  })

  res.json({ ok: true, url: publishedUrl })
})

app.listen(3001, () => console.log('CooVex receiver on :3001'))
`

const NEXTJS_CODE = `// app/api/coovex/receive/route.ts  (or pages/api/coovex/receive.ts)
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

const SECRET = process.env.COOVEX_SECRET || ''

export async function POST(req: NextRequest) {
  const body = await req.text()

  // ── 1. Verify signature ──────────────────────────────────────────────────
  if (SECRET) {
    const sig = req.headers.get('x-coovex-signature') ?? ''
    const expected = 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex')
    if (sig !== expected) return NextResponse.json({ error: 'Bad signature' }, { status: 401 })
  }

  const data = JSON.parse(body)
  const { title, content, channel, confirm_url, api_key } = data

  // ── 2. Save to your database (example: Prisma) ───────────────────────────
  // const post = await prisma.post.create({
  //   data: { title, content, channel, slug: slugify(title), published: true }
  // })
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)
  const publishedUrl = \`\${process.env.NEXT_PUBLIC_SITE_URL}/blog/\${slug}\`

  // ── 3. Confirm back to CooVex ────────────────────────────────────────────
  await fetch(confirm_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key,
      external_url: publishedUrl,
      published_at: new Date().toISOString(),
    }),
  })

  return NextResponse.json({ ok: true, url: publishedUrl })
}
`

const PYTHON_CODE = `# receiver.py — Python / Flask
# pip install flask requests

from flask import Flask, request, jsonify
import hmac, hashlib, requests, os
from datetime import datetime

app   = Flask(__name__)
SECRET = os.environ.get('COOVEX_SECRET', '')

@app.route('/coovex/receive', methods=['POST'])
def receive():
    body = request.get_data()

    # ── 1. Verify signature ──────────────────────────────────────────────────
    if SECRET:
        sig = request.headers.get('X-CooVex-Signature', '')
        expected = 'sha256=' + hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return jsonify({'error': 'Bad signature'}), 401

    data        = request.json
    title       = data.get('title', 'New Post')
    content     = data.get('content', '')
    channel     = data.get('channel', 'blog')
    confirm_url = data.get('confirm_url')
    api_key     = data.get('api_key')

    # ── 2. Publish to your CMS ───────────────────────────────────────────────
    slug = '-'.join(title.lower().split())[:60]
    published_url = f"https://yoursite.com/blog/{slug}"
    # TODO: save to your DB, call Ghost/Contentful/Sanity API, etc.

    # ── 3. Confirm back to CooVex ────────────────────────────────────────────
    requests.post(confirm_url, json={
        'api_key':      api_key,
        'external_url': published_url,
        'published_at': datetime.utcnow().isoformat() + 'Z',
    }, timeout=10)

    return jsonify({'ok': True, 'url': published_url})

if __name__ == '__main__':
    app.run(port=3001)
`

const AJAX_CODE = `<!-- Pure HTML + JavaScript — no server required for simple display use -->
<!-- But to AUTO-PUBLISH you still need a small backend endpoint.      -->
<!-- This example shows how to FETCH pending posts client-side.        -->

<script>
const API_KEY = 'cvx_your_api_key_here'
const COOVEX  = 'https://app.coovex.com'

// ── Pull pending posts ───────────────────────────────────────────────────────
async function fetchPendingPosts() {
  const res  = await fetch(\`\${COOVEX}/api/public/posts?api_key=\${API_KEY}&status=pending_approval\`)
  const data = await res.json()
  return data.posts  // array of { id, title, content, channel, ... }
}

// ── Confirm a post as published ──────────────────────────────────────────────
async function confirmPublished(postId, externalUrl) {
  const res = await fetch(\`\${COOVEX}/api/public/posts/\${postId}/confirm\`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:      API_KEY,
      external_url: externalUrl,
      published_at: new Date().toISOString(),
    }),
  })
  return res.json()
}

// ── Example: inject post into your page DOM ──────────────────────────────────
async function loadAndRender() {
  const posts = await fetchPendingPosts()
  const container = document.getElementById('blog-container')

  for (const post of posts) {
    const el = document.createElement('article')
    el.innerHTML = \`<h2>\${post.title}</h2><div>\${post.content}</div>\`
    container.appendChild(el)

    // Confirm that we displayed it
    await confirmPublished(post.id, window.location.href)
  }
}

loadAndRender()
</script>

<!-- NOTE: For real auto-publishing (saving to a CMS/DB), you need   -->
<!-- a backend endpoint — use the PHP, Node.js, or Python examples.  -->
`

const CURL_CODE = `# ── Test your webhook locally with cURL ─────────────────────────────────────

# 1. Simulate CooVex pushing a post to your webhook URL
curl -X POST https://yoursite.com/coovex/receive \\
  -H "Content-Type: application/json" \\
  -H "X-CooVex-Event: post.push" \\
  -d '{
    "post_id":    "test-123",
    "title":      "Test Article from CooVex",
    "content":    "This is the article body. AI generated this.",
    "channel":    "wordpress",
    "business":   "My Business",
    "api_key":    "cvx_your_api_key",
    "confirm_url":"https://app.coovex.com/api/public/posts/test-123/confirm",
    "pushed_at":  "2026-07-04T10:00:00Z"
  }'

# 2. Manually confirm a post as published (without waiting for webhook)
curl -X POST https://app.coovex.com/api/public/posts/POST_ID/confirm \\
  -H "Content-Type: application/json" \\
  -d '{
    "api_key":      "cvx_your_api_key",
    "external_url": "https://yoursite.com/blog/test-article",
    "published_at": "2026-07-04T10:01:00Z"
  }'

# 3. Pull all pending posts
curl "https://app.coovex.com/api/public/posts?api_key=cvx_your_api_key&status=pending_approval"

# 4. Generate HMAC signature (to verify your receiver works)
echo -n '{"post_id":"test"}' | openssl dgst -sha256 -hmac "your_secret"
# compare with X-CooVex-Signature header
`

const GHOST_CODE = `// Ghost CMS integration via Ghost Admin API
// npm install @tryghost/admin-api

import GhostAdminAPI from '@tryghost/admin-api'
import express from 'express'
import crypto from 'crypto'

const api = new GhostAdminAPI({
  url:     'https://your-ghost-site.com',
  key:     'your_ghost_admin_api_key',  // Ghost Admin → Integrations → Add custom integration
  version: 'v5.0',
})

const app    = express()
const SECRET = process.env.COOVEX_SECRET || ''
app.use(express.json({ verify: (req, _, buf) => { req.rawBody = buf } }))

app.post('/coovex/receive', async (req, res) => {
  // Verify signature
  if (SECRET) {
    const sig = req.headers['x-coovex-signature']
    const exp = 'sha256=' + crypto.createHmac('sha256', SECRET).update(req.rawBody).digest('hex')
    if (sig !== exp) return res.status(401).json({ error: 'Bad signature' })
  }

  const { title, content, channel, confirm_url, api_key } = req.body

  // Publish to Ghost
  const post = await api.posts.add({
    title,
    html:   content,
    status: 'published',
    tags:   [{ name: channel }],
  }, { source: 'html' })

  // Confirm back to CooVex
  await fetch(confirm_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key, external_url: post.url, published_at: new Date().toISOString() }),
  })

  res.json({ ok: true, url: post.url })
})

app.listen(3001)
`

// ─── Main Component ───────────────────────────────────────────────────────────

type PlatformKey = 'wordpress' | 'php' | 'node' | 'nextjs' | 'python' | 'ajax' | 'ghost' | 'curl'

const PLATFORMS: { key: PlatformKey; label: string; emoji: string; desc: string }[] = [
  { key: 'wordpress', label: 'WordPress', emoji: '🔵', desc: 'Auto-publish as WP posts via plugin' },
  { key: 'php',       label: 'PHP',       emoji: '🐘', desc: 'Pure PHP, any hosting / cPanel' },
  { key: 'node',      label: 'Node.js',   emoji: '🟢', desc: 'Express server receiver' },
  { key: 'nextjs',    label: 'Next.js',   emoji: '⚫', desc: 'Next.js API route receiver' },
  { key: 'python',    label: 'Python',    emoji: '🐍', desc: 'Flask server receiver' },
  { key: 'ghost',     label: 'Ghost CMS', emoji: '👻', desc: 'Publish via Ghost Admin API' },
  { key: 'ajax',      label: 'JavaScript', emoji: '🟡', desc: 'Vanilla JS pull model' },
  { key: 'curl',      label: 'cURL / Test', emoji: '🔧', desc: 'Test & manual confirm' },
]

interface ContentPushSectionProps {
  appUrl: string
}

export default function ContentPushSection({ appUrl }: ContentPushSectionProps) {
  const [apiKey, setApiKey]           = useState('')
  const [webhookUrl, setWebhookUrl]   = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [autoPush, setAutoPush]       = useState(false)
  const [showKey, setShowKey]         = useState(false)
  const [showSecret, setShowSecret]   = useState(false)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [saved, setSaved]             = useState(false)
  const [platform, setPlatform]       = useState<PlatformKey>('wordpress')
  const [docsOpen, setDocsOpen]       = useState(false)

  useEffect(() => {
    fetch('/api/business/api-key')
      .then(r => r.json())
      .then(d => {
        setApiKey(d.api_key ?? '')
        setWebhookUrl(d.webhook_url ?? '')
        setWebhookSecret(d.webhook_secret ?? '')
        setAutoPush(d.auto_push ?? false)
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    await fetch('/api/business/api-key', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhook_url: webhookUrl, webhook_secret: webhookSecret, auto_push: autoPush }),
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const regenerate = async () => {
    if (!confirm('This will invalidate your current API key. All integrations must be updated with the new key. Continue?')) return
    setRegenerating(true)
    const d = await fetch('/api/business/api-key', { method: 'POST' }).then(r => r.json())
    setApiKey(d.api_key ?? '')
    setRegenerating(false)
  }

  const maskedKey = apiKey ? apiKey.slice(0, 10) + '•'.repeat(Math.max(apiKey.length - 10, 8)) : ''

  const codeMap: Record<PlatformKey, string> = {
    wordpress: WORDPRESS_PLUGIN,
    php:       PHP_CODE,
    node:      NODE_CODE,
    nextjs:    NEXTJS_CODE,
    python:    PYTHON_CODE,
    ajax:      AJAX_CODE,
    ghost:     GHOST_CODE,
    curl:      CURL_CODE,
  }

  const langMap: Record<PlatformKey, string> = {
    wordpress: 'php', php: 'php', node: 'javascript', nextjs: 'typescript',
    python: 'python', ajax: 'html + javascript', ghost: 'javascript', curl: 'bash',
  }

  // Replace placeholder API key in code with real one
  const liveCode = apiKey
    ? codeMap[platform].replace(/cvx_your_api_key(_here)?/g, apiKey)
    : codeMap[platform]

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4 p-6 border-b border-slate-800">
        <div className="w-12 h-12 bg-blue-950/50 border border-blue-900/50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">📤</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold">Content Push API</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-600/30">NEW</span>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            Auto-publish CooVex AI content to any website or CMS. Works with WordPress, PHP, Node.js, Python, Ghost — anything that can receive a POST request.
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* API Key */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your API Key</label>
          </div>
          <p className="text-slate-600 text-xs mb-2">Use this in your integration to pull content and send confirm callbacks.</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 font-mono text-sm min-w-0">
              {loading
                ? <span className="text-slate-600 text-xs">Loading…</span>
                : <span className="text-slate-300 flex-1 truncate">{showKey ? apiKey : maskedKey}</span>
              }
              <button onClick={() => setShowKey(v => !v)} className="text-slate-600 hover:text-slate-400 flex-shrink-0">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {apiKey && <CopyButton text={apiKey} label="Copy" />}
            <button onClick={regenerate} disabled={regenerating} title="Regenerate"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {apiKey && (
            <p className="text-[11px] font-mono text-slate-700 mt-1.5">
              Pull URL: <span className="text-slate-500">{appUrl}/api/public/posts?api_key={showKey ? apiKey : maskedKey}</span>
            </p>
          )}
        </div>

        {/* Webhook URL */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Webhook URL <span className="normal-case font-normal text-slate-600">— where CooVex sends content</span>
          </label>
          <p className="text-slate-600 text-xs mb-2">CooVex POSTs here when content is pushed — automatically after generation (auto mode) or when you click "Push to Site" (manual mode). Your server publishes it, then confirms back.</p>
          <input
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://yoursite.com/coovex/receive"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* Webhook Secret */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Webhook Secret <span className="normal-case font-normal text-slate-600">— optional HMAC signing key</span>
          </label>
          <p className="text-slate-600 text-xs mb-2">CooVex signs every request with this. Your server verifies it to reject spoofed requests. Highly recommended in production.</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                value={webhookSecret}
                onChange={e => setWebhookSecret(e.target.value)}
                type={showSecret ? 'text' : 'password'}
                placeholder="any random string — e.g. openssl rand -hex 32"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-600 pr-10"
              />
              <button onClick={() => setShowSecret(v => !v)} className="absolute right-3 top-2.5 text-slate-600 hover:text-slate-400">
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {webhookSecret && <CopyButton text={webhookSecret} />}
          </div>
        </div>

        {/* Auto-push toggle */}
        <div className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
          autoPush
            ? 'bg-blue-950/30 border-blue-700/40'
            : 'bg-slate-900/50 border-slate-800'
        }`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-white">Auto-push after generation</span>
              {autoPush && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-600/30">ON</span>
              )}
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">
              When enabled, CooVex automatically pushes content to your webhook immediately after AI generates it — no manual button click needed.
              {!webhookUrl && <span className="text-amber-500"> Requires a webhook URL above.</span>}
            </p>
            {autoPush && webhookUrl && (
              <p className="text-blue-400 text-xs mt-1.5">
                ✓ Content will be pushed to <span className="font-mono">{webhookUrl.length > 40 ? webhookUrl.slice(0, 40) + '…' : webhookUrl}</span> automatically.
              </p>
            )}
          </div>
          <button
            onClick={() => setAutoPush(v => !v)}
            disabled={!webhookUrl}
            title={!webhookUrl ? 'Add a webhook URL first' : undefined}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
              autoPush ? 'bg-blue-600' : 'bg-slate-700'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoPush ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Save */}
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Integration Settings'}
        </button>

        {/* How it works */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-300">How it works</span>
          </div>

          {/* Auto-push mode */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-600/30">AUTO MODE</span>
              <span className="text-xs text-slate-500">— Auto-push toggle ON</span>
            </div>
            <div className="space-y-2">
              {[
                { n: '1', t: 'AI generates content', d: 'GEO Optimizer or AI Agent generates a post.' },
                { n: '2', t: 'Instant push', d: 'CooVex immediately POSTs to your webhook URL — no button click needed.' },
                { n: '3', t: 'Your site publishes', d: 'Your receiver saves/publishes the article, then calls the confirm URL with the live page URL.' },
                { n: '4', t: 'CooVex syncs', d: 'Post marked Published. Agent Inbox notified. GEO memory updated with published content.' },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</span>
                  <div>
                    <span className="text-slate-300 text-xs font-semibold">{s.t} </span>
                    <span className="text-slate-500 text-xs">— {s.d}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-700">MANUAL MODE</span>
              <span className="text-xs text-slate-500">— Auto-push toggle OFF</span>
            </div>
            <div className="space-y-2">
              {[
                { n: '1', t: 'AI generates content', d: 'Content saved as draft in CooVex Content Calendar.' },
                { n: '2', t: 'Review & push', d: 'Go to Content page, review the draft, click "Push to Site" when ready.' },
                { n: '3', t: 'Your site publishes', d: 'Your receiver saves/publishes, confirms back to CooVex.' },
                { n: '4', t: 'CooVex syncs', d: 'Same as auto mode — post marked Published, memory updated.' },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-slate-700/50 text-slate-500 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</span>
                  <div>
                    <span className="text-slate-400 text-xs font-semibold">{s.t} </span>
                    <span className="text-slate-600 text-xs">— {s.d}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Documentation + Code */}
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <button onClick={() => setDocsOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold text-slate-200">Integration Code & Docs</span>
              <span className="text-[10px] text-slate-500">— PHP · WordPress · Node.js · Next.js · Python · Ghost · JavaScript · cURL</span>
            </div>
            {docsOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>

          {docsOpen && (
            <div className="border-t border-slate-800">
              {/* Platform selector */}
              <div className="p-4 pb-0 grid grid-cols-4 gap-1.5">
                {PLATFORMS.map(p => (
                  <button key={p.key} onClick={() => setPlatform(p.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left ${
                      platform === p.key
                        ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                    }`}>
                    <span>{p.emoji}</span>
                    <span className="font-medium">{p.label}</span>
                  </button>
                ))}
              </div>

              <div className="p-4 space-y-4">
                {/* Platform description */}
                <div className={`rounded-xl px-4 py-3 text-sm border ${
                  platform === 'wordpress' ? 'bg-blue-950/20 border-blue-900/30 text-blue-300' :
                  platform === 'php'       ? 'bg-indigo-950/20 border-indigo-900/30 text-indigo-300' :
                  platform === 'node'      ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-300' :
                  platform === 'nextjs'    ? 'bg-slate-800/50 border-slate-700 text-slate-300' :
                  platform === 'python'    ? 'bg-amber-950/20 border-amber-900/30 text-amber-300' :
                  platform === 'ghost'     ? 'bg-gray-900 border-gray-700 text-gray-300' :
                  platform === 'ajax'      ? 'bg-yellow-950/20 border-yellow-900/30 text-yellow-300' :
                                             'bg-slate-800/50 border-slate-700 text-slate-300'
                }`}>
                  {platform === 'wordpress' && <><strong>WordPress Plugin</strong> — Copy to <code className="bg-black/20 px-1 rounded">wp-content/plugins/coovex-push/coovex-push.php</code>, activate it. Webhook URL: <code className="bg-black/20 px-1 rounded">https://yoursite.com/wp-json/coovex/v1/receive</code></>}
                  {platform === 'php'       && <><strong>Pure PHP</strong> — Save as <code className="bg-black/20 px-1 rounded">coovex-receiver.php</code> on any PHP hosting (cPanel, Hostinger, etc.). Set your Webhook URL to that file's public URL.</>}
                  {platform === 'node'      && <><strong>Node.js / Express</strong> — Run <code className="bg-black/20 px-1 rounded">npm install express</code>. Set <code className="bg-black/20 px-1 rounded">COOVEX_SECRET</code> env var. Deploy to Railway, Render, VPS, etc.</>}
                  {platform === 'nextjs'    && <><strong>Next.js API Route</strong> — Drop this into <code className="bg-black/20 px-1 rounded">app/api/coovex/receive/route.ts</code>. Set <code className="bg-black/20 px-1 rounded">COOVEX_SECRET</code> in <code className="bg-black/20 px-1 rounded">.env.local</code>.</>}
                  {platform === 'python'    && <><strong>Python / Flask</strong> — <code className="bg-black/20 px-1 rounded">pip install flask requests</code>. Set <code className="bg-black/20 px-1 rounded">COOVEX_SECRET</code> env var. Deploy to PythonAnywhere, Railway, Heroku, VPS.</>}
                  {platform === 'ghost'     && <><strong>Ghost CMS</strong> — Get your Admin API key from Ghost Admin → Integrations. Deploy this as a small Node.js sidecar or serverless function alongside Ghost.</>}
                  {platform === 'ajax'      && <><strong>Vanilla JavaScript</strong> — For <em>pulling</em> content client-side. No server needed for display, but you still need a backend to persist/publish. Good for SPAs.</>}
                  {platform === 'curl'      && <><strong>cURL / Testing</strong> — Test your webhook locally, simulate pushes, and manually confirm posts. Use before going live to verify your integration.</>}
                </div>

                {/* Code */}
                <CodeBlock code={liveCode} lang={langMap[platform]} />

                {/* API Spec always visible at bottom */}
                <details className="group">
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 transition-colors select-none flex items-center gap-1.5">
                    <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                    Full API Reference (payload, headers, confirm endpoint)
                  </summary>
                  <div className="mt-3">
                    <CodeBlock lang="http" code={`# ── Payload CooVex sends to YOUR webhook ───────────────────────────────────
POST {your_webhook_url}
Content-Type: application/json
X-CooVex-Event: post.push
X-CooVex-Post-Id: <uuid>
X-CooVex-Signature: sha256=<hmac_sha256_hex>   # if webhook_secret is set

{
  "post_id":    "uuid",
  "title":      "Article title",
  "content":    "Full article body (may include markdown/HTML)",
  "channel":    "wordpress",    // wordpress | linkedin | facebook | etc.
  "business":   "Business Name",
  "api_key":    "${apiKey || 'cvx_xxxx'}",
  "confirm_url": "${appUrl}/api/public/posts/<id>/confirm",
  "pushed_at":  "2026-07-04T10:30:00Z"
}

# ── Your server must respond 200 OK within 15 seconds ──────────────────────
{ "ok": true }   // or any 2xx response

# ── Then confirm publish back to CooVex ────────────────────────────────────
POST ${appUrl}/api/public/posts/<post_id>/confirm
Content-Type: application/json

{
  "api_key":      "${apiKey || 'cvx_xxxx'}",
  "external_url": "https://yoursite.com/blog/article-slug",  // optional but recommended
  "published_at": "2026-07-04T10:31:00Z"
}

# Response:
{ "ok": true, "message": "Post marked as published" }

# ── Pull pending posts (polling alternative) ────────────────────────────────
GET ${appUrl}/api/public/posts?api_key=${apiKey || 'cvx_xxxx'}&status=pending_approval

# ── HMAC signature verification ─────────────────────────────────────────────
# Header: X-CooVex-Signature: sha256=XXXX
# Verify: HMAC_SHA256(request_body_bytes, webhook_secret) == XXXX`} />
                  </div>
                </details>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
