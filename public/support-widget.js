(function () {
  'use strict';

  var cfg = window.CooVexSupport || {};
  if (!cfg.key) return;

  var API  = (cfg.apiUrl  || 'https://app.coovex.com') + '/api/support/ingest';
  var color    = cfg.color    || '#2563eb';
  var position = cfg.position || 'bottom-right';
  var title    = cfg.title    || 'Support';
  var subtitle = cfg.subtitle || 'How can we help?';
  var welcome  = cfg.welcome  || 'Hi! How can we help you today?';

  // Session: persist conversation_id in localStorage
  var SESSION_KEY = 'cvx_support_session_' + cfg.key;
  var session = {};
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}'); } catch (e) {}

  // ── Styles ──────────────────────────────────────────────────
  var css = `
    #cvx-widget-btn {
      position: fixed; z-index: 999999; cursor: pointer;
      width: 56px; height: 56px; border-radius: 50%;
      border: none; background: ${color};
      box-shadow: 0 4px 16px rgba(0,0,0,.25);
      display: flex; align-items: center; justify-content: center;
      transition: transform .2s, box-shadow .2s;
    }
    #cvx-widget-btn:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,.3); }
    #cvx-widget-btn svg { width: 26px; height: 26px; fill: white; }
    #cvx-widget-badge {
      position: absolute; top: -3px; right: -3px;
      width: 16px; height: 16px; background: #ef4444;
      border-radius: 50%; border: 2px solid white;
      display: none; align-items: center; justify-content: center;
      font-size: 9px; color: white; font-weight: 700; font-family: sans-serif;
    }
    #cvx-panel {
      position: fixed; z-index: 999998; overflow: hidden;
      width: 360px; height: 520px; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,.18);
      display: flex; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px; background: #f8fafc;
      transition: opacity .2s, transform .2s;
    }
    #cvx-panel.cvx-hidden { opacity: 0; pointer-events: none; transform: translateY(12px); }
    #cvx-header {
      background: ${color}; padding: 16px 18px; color: white;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
    }
    #cvx-header h4 { margin: 0; font-size: 15px; font-weight: 700; }
    #cvx-header p  { margin: 2px 0 0; font-size: 12px; opacity: .85; }
    #cvx-close-btn {
      background: rgba(255,255,255,.2); border: none; color: white;
      width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; line-height: 1; flex-shrink: 0;
    }
    #cvx-messages {
      flex: 1; overflow-y: auto; padding: 14px 14px 8px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .cvx-msg {
      max-width: 85%; padding: 10px 13px; border-radius: 14px;
      line-height: 1.5; font-size: 13px; word-break: break-word;
    }
    .cvx-msg-in  { background: white; border: 1px solid #e2e8f0; color: #1e293b; border-radius: 14px 14px 14px 4px; align-self: flex-start; }
    .cvx-msg-out { background: ${color}; color: white; border-radius: 14px 14px 4px 14px; align-self: flex-end; }
    .cvx-msg-time { font-size: 10px; opacity: .55; margin-top: 3px; }
    #cvx-info-form { padding: 12px 14px; background: white; border-top: 1px solid #e9edf2; flex-shrink: 0; }
    #cvx-info-form input {
      width: 100%; margin-bottom: 8px; padding: 8px 10px; border-radius: 8px;
      border: 1px solid #cbd5e1; font-size: 13px; box-sizing: border-box;
      outline: none;
    }
    #cvx-info-form input:focus { border-color: ${color}; }
    #cvx-reply-bar {
      display: flex; align-items: flex-end; gap: 8px;
      padding: 10px 14px; background: white; border-top: 1px solid #e9edf2; flex-shrink: 0;
    }
    #cvx-reply-input {
      flex: 1; resize: none; border: 1px solid #cbd5e1; border-radius: 10px;
      padding: 8px 10px; font-size: 13px; line-height: 1.4; font-family: inherit;
      max-height: 80px; outline: none;
    }
    #cvx-reply-input:focus { border-color: ${color}; }
    #cvx-send-btn {
      background: ${color}; border: none; color: white; width: 36px; height: 36px;
      border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: background .15s;
    }
    #cvx-send-btn:disabled { opacity: .5; cursor: not-allowed; }
    #cvx-send-btn svg { width: 16px; height: 16px; fill: white; }
    #cvx-powered { text-align: center; font-size: 10px; color: #94a3b8; padding: 6px; flex-shrink: 0; }
    #cvx-powered a { color: ${color}; text-decoration: none; }
    @media (max-width: 420px) {
      #cvx-panel { width: calc(100vw - 24px); height: calc(100vh - 100px); border-radius: 12px; }
    }
  `;

  var posStyles = position === 'bottom-left'
    ? 'bottom:24px;left:24px;'
    : 'bottom:24px;right:24px;';
  var panelPos  = position === 'bottom-left'
    ? 'bottom:88px;left:12px;'
    : 'bottom:88px;right:12px;';

  // ── DOM ────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Button
  var btn = document.createElement('div');
  btn.id = 'cvx-widget-btn';
  btn.style.cssText = posStyles;
  btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/></svg>`;
  var badge = document.createElement('div');
  badge.id = 'cvx-widget-badge';
  btn.appendChild(badge);
  document.body.appendChild(btn);

  // Panel
  var panel = document.createElement('div');
  panel.id = 'cvx-panel';
  panel.style.cssText = panelPos;
  panel.classList.add('cvx-hidden');
  panel.innerHTML = `
    <div id="cvx-header">
      <div>
        <h4>${escHtml(title)}</h4>
        <p>${escHtml(subtitle)}</p>
      </div>
      <button id="cvx-close-btn">&#x2715;</button>
    </div>
    <div id="cvx-messages"></div>
    <div id="cvx-info-form">
      <input id="cvx-name-input"  type="text"  placeholder="Your name" />
      <input id="cvx-email-input" type="email" placeholder="Your email (for reply)" />
    </div>
    <div id="cvx-reply-bar">
      <textarea id="cvx-reply-input" rows="1" placeholder="Type a message…"></textarea>
      <button id="cvx-send-btn">
        <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
      </button>
    </div>
    <div id="cvx-powered">Powered by <a href="https://coovex.com" target="_blank">CooVex</a></div>
  `;
  document.body.appendChild(panel);

  var msgContainer = panel.querySelector('#cvx-messages');
  var nameInput    = panel.querySelector('#cvx-name-input');
  var emailInput   = panel.querySelector('#cvx-email-input');
  var replyInput   = panel.querySelector('#cvx-reply-input');
  var sendBtn      = panel.querySelector('#cvx-send-btn');
  var infoForm     = panel.querySelector('#cvx-info-form');

  // Restore saved name/email
  if (session.name)  nameInput.value  = session.name;
  if (session.email) emailInput.value = session.email;
  if (session.conversation_id) infoForm.style.display = 'none';

  // ── Helpers ────────────────────────────────────────────────
  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function saveSession(data) {
    Object.assign(session, data);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
  }

  function addMsg(content, isOut, time) {
    var d = document.createElement('div');
    d.innerHTML = `<div class="cvx-msg ${isOut ? 'cvx-msg-out' : 'cvx-msg-in'}">${escHtml(content)}<div class="cvx-msg-time">${time || 'now'}</div></div>`;
    msgContainer.appendChild(d.firstChild);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function showWelcome() {
    if (!session.welcomed) {
      addMsg(welcome, false);
      saveSession({ welcomed: true });
    }
  }

  // ── Events ─────────────────────────────────────────────────
  btn.addEventListener('click', function () {
    var isHidden = panel.classList.contains('cvx-hidden');
    if (isHidden) {
      panel.classList.remove('cvx-hidden');
      showWelcome();
      replyInput.focus();
    } else {
      panel.classList.add('cvx-hidden');
    }
  });

  panel.querySelector('#cvx-close-btn').addEventListener('click', function () {
    panel.classList.add('cvx-hidden');
  });

  // Auto-resize textarea
  replyInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  // Send on Ctrl/Cmd+Enter or click
  replyInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
  sendBtn.addEventListener('click', doSend);

  function doSend() {
    var msg = replyInput.value.trim();
    if (!msg) return;
    var name  = nameInput.value.trim();
    var email = emailInput.value.trim();
    sendBtn.disabled = true;
    addMsg(msg, true);
    replyInput.value = '';
    replyInput.style.height = 'auto';
    if (name || email) saveSession({ name: name, email: email });

    var payload = {
      key:        cfg.key,
      message:    msg,
      name:       name  || undefined,
      email:      email || undefined,
      session_id: session.conversation_id || undefined,
      url:        window.location.href,
    };

    fetch(API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        sendBtn.disabled = false;
        if (data.conversation_id) {
          saveSession({ conversation_id: data.conversation_id });
          infoForm.style.display = 'none';
        }
        if (data.auto_reply) {
          setTimeout(function () { addMsg(data.auto_reply, false); }, 600);
        }
      })
      .catch(function () {
        sendBtn.disabled = false;
        addMsg('Failed to send. Please try again.', false);
      });
  }
})();
