import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Verify token belongs to a real business
  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('embed_token', token)
    .maybeSingle()

  if (!business) {
    return new NextResponse('/* Invalid embed token */', {
      status: 404,
      headers: { 'Content-Type': 'application/javascript' },
    })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coovex.com'
  const script = generateScript(appUrl, token, business.name)

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

function generateScript(appUrl: string, token: string, businessName: string): string {
  return `
/* CooVex Lead Capture Widget — ${businessName} */
(function(w, d) {
  'use strict';

  var COOVEX_TOKEN = '${token}';
  var COOVEX_URL = '${appUrl}';

  // --- Widget styles ---
  var style = d.createElement('style');
  style.textContent = [
    '#coovex-widget { position: fixed; bottom: 24px; right: 24px; z-index: 9999; font-family: system-ui, sans-serif; }',
    '#coovex-btn { width: 56px; height: 56px; border-radius: 50%; background: #7c3aed; color: white; border: none; cursor: pointer; font-size: 24px; box-shadow: 0 4px 24px rgba(124,58,237,0.4); transition: transform 0.2s; display: flex; align-items: center; justify-content: center; }',
    '#coovex-btn:hover { transform: scale(1.08); }',
    '#coovex-panel { position: absolute; bottom: 68px; right: 0; width: 320px; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 20px; box-shadow: 0 8px 40px rgba(0,0,0,0.5); display: none; }',
    '#coovex-panel.open { display: block; animation: pvSlideUp 0.2s ease; }',
    '@keyframes pvSlideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }',
    '#coovex-panel h3 { color: #fff; font-size: 15px; font-weight: 600; margin: 0 0 4px; }',
    '#coovex-panel p { color: #94a3b8; font-size: 13px; margin: 0 0 14px; }',
    '#coovex-panel input { width: 100%; box-sizing: border-box; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 8px 12px; color: #fff; font-size: 13px; margin-bottom: 8px; outline: none; }',
    '#coovex-panel input:focus { border-color: #7c3aed; }',
    '#coovex-panel button[type=submit] { width: 100%; background: #7c3aed; color: #fff; border: none; border-radius: 8px; padding: 9px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s; }',
    '#coovex-panel button[type=submit]:hover { background: #6d28d9; }',
    '#coovex-panel button[type=submit]:disabled { opacity: 0.6; cursor: default; }',
    '#coovex-success { color: #34d399; font-size: 13px; text-align: center; padding: 8px 0; display: none; }',
    '#coovex-close { position: absolute; top: 12px; right: 14px; background: none; border: none; color: #64748b; cursor: pointer; font-size: 18px; line-height: 1; padding: 0; }',
    '#coovex-close:hover { color: #94a3b8; }',
  ].join('');
  d.head.appendChild(style);

  // --- Widget HTML ---
  var widget = d.createElement('div');
  widget.id = 'coovex-widget';
  widget.innerHTML = '<button id="coovex-btn" title="Get in touch">💬</button>' +
    '<div id="coovex-panel">' +
      '<button id="coovex-close">×</button>' +
      '<h3>Let\\'s connect</h3>' +
      '<p>Leave your details and we\\'ll be in touch.</p>' +
      '<form id="coovex-form">' +
        '<input name="name" type="text" placeholder="Your name" required />' +
        '<input name="email" type="email" placeholder="Email address" required />' +
        '<input name="company" type="text" placeholder="Company (optional)" />' +
        '<button type="submit">Send →</button>' +
      '</form>' +
      '<div id="coovex-success">✓ Got it! We\\'ll be in touch soon.</div>' +
    '</div>';
  d.body.appendChild(widget);

  // --- Logic ---
  var btn = d.getElementById('coovex-btn');
  var panel = d.getElementById('coovex-panel');
  var closeBtn = d.getElementById('coovex-close');
  var form = d.getElementById('coovex-form');
  var successMsg = d.getElementById('coovex-success');

  btn.addEventListener('click', function() {
    panel.classList.toggle('open');
  });
  closeBtn.addEventListener('click', function() {
    panel.classList.remove('open');
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var submitBtn = form.querySelector('[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    var data = {
      token: COOVEX_TOKEN,
      name: form.querySelector('[name=name]').value,
      email: form.querySelector('[name=email]').value,
      company: form.querySelector('[name=company]').value,
      source: 'website_embed',
      page_url: w.location.href,
    };

    fetch(COOVEX_URL + '/api/embed/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    .then(function(r) { return r.json(); })
    .then(function() {
      form.style.display = 'none';
      successMsg.style.display = 'block';
      setTimeout(function() { panel.classList.remove('open'); }, 3000);
    })
    .catch(function() {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send →';
    });
  });
})(window, document);
`
}
