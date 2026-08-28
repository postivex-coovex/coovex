(function () {
  'use strict';

  var cfg = window.CooVexSupport || {};
  if (!cfg.key) return;

  var BASE      = cfg.apiUrl  || 'https://app.coovex.com';
  var API       = BASE + '/api/support/ingest';
  var MSGS_API  = BASE + '/api/support/widget/messages';
  var AGENT_API = BASE + '/api/support/agent/run';
  var color    = cfg.color    || '#2563eb';
  var position = cfg.position || 'bottom-right';
  var title    = cfg.title    || 'Support';
  var subtitle = cfg.subtitle || 'How can we help?';
  var welcome  = cfg.welcome  || 'Hi! How can we help you today?';

  var SESSION_KEY = 'cvx_support_session_' + cfg.key;
  var session = {};
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}'); } catch (e) {}

  var selectedFiles = [];
  var MAX_FILES = 5;
  var MAX_SIZE  = 10 * 1024 * 1024; // 10 MB

  var pollTimer      = null;
  var lastMsgTime    = null;
  var seenMsgIds     = {};
  var historyLoaded  = false;

  // ── Styles ──────────────────────────────────────────────────────
  var css = `
    #cvx-widget-btn {
      position:fixed;z-index:999999;cursor:pointer;
      width:56px;height:56px;border-radius:50%;border:none;
      background:${color};box-shadow:0 4px 16px rgba(0,0,0,.25);
      display:flex;align-items:center;justify-content:center;
      transition:transform .2s,box-shadow .2s;
    }
    #cvx-widget-btn:hover{transform:scale(1.08);box-shadow:0 6px 20px rgba(0,0,0,.3);}
    #cvx-widget-btn svg{width:26px;height:26px;fill:white;}
    #cvx-widget-badge{
      position:absolute;top:-3px;right:-3px;width:16px;height:16px;
      background:#ef4444;border-radius:50%;border:2px solid white;
      display:none;align-items:center;justify-content:center;
      font-size:9px;color:white;font-weight:700;font-family:sans-serif;
    }
    #cvx-panel{
      position:fixed;z-index:999998;overflow:hidden;
      width:360px;border-radius:16px;
      box-shadow:0 8px 40px rgba(0,0,0,.18);
      display:flex;flex-direction:column;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;background:#f8fafc;
      transition:opacity .2s,transform .2s;
      max-height:580px;
    }
    #cvx-panel.cvx-hidden{opacity:0;pointer-events:none;transform:translateY(12px);}
    #cvx-header{
      background:${color};padding:16px 18px;color:white;
      display:flex;align-items:center;justify-content:space-between;flex-shrink:0;
    }
    #cvx-header h4{margin:0;font-size:15px;font-weight:700;}
    #cvx-header p{margin:2px 0 0;font-size:12px;opacity:.85;}
    #cvx-close-btn{
      background:rgba(255,255,255,.2);border:none;color:white;
      width:28px;height:28px;border-radius:50%;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      font-size:18px;line-height:1;flex-shrink:0;
    }
    #cvx-messages{
      flex:1;overflow-y:auto;padding:14px 14px 8px;
      display:flex;flex-direction:column;gap:10px;min-height:80px;
    }
    .cvx-msg{
      max-width:85%;padding:10px 13px;border-radius:14px;
      line-height:1.5;font-size:13px;word-break:break-word;
    }
    .cvx-msg-in{background:white;border:1px solid #e2e8f0;color:#1e293b;border-radius:14px 14px 14px 4px;align-self:flex-start;}
    .cvx-msg-out{background:${color};color:white;border-radius:14px 14px 4px 14px;align-self:flex-end;}
    .cvx-msg-time{font-size:10px;opacity:.55;margin-top:3px;}
    .cvx-msg-attachments{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
    .cvx-attach-img{width:80px;height:60px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid rgba(0,0,0,.1);}
    .cvx-attach-file{
      display:inline-flex;align-items:center;gap:5px;
      padding:4px 8px;border-radius:6px;font-size:11px;
      background:rgba(0,0,0,.08);color:inherit;text-decoration:none;
      max-width:180px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
    }
    #cvx-info-form{padding:12px 14px;background:white;border-top:1px solid #e9edf2;flex-shrink:0;}
    #cvx-info-form input{
      width:100%;margin-bottom:6px;padding:8px 10px;border-radius:8px;
      border:1px solid #cbd5e1;font-size:13px;box-sizing:border-box;outline:none;
    }
    #cvx-info-form input:focus{border-color:${color};}
    #cvx-info-form input:last-child{margin-bottom:0;}
    #cvx-file-preview{
      padding:8px 14px;background:white;border-top:1px solid #e9edf2;
      display:none;flex-wrap:wrap;gap:6px;max-height:120px;overflow-y:auto;flex-shrink:0;
    }
    .cvx-fchip{
      display:inline-flex;align-items:center;gap:4px;
      background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;
      padding:4px 6px;font-size:11px;color:#475569;max-width:140px;
    }
    .cvx-fchip-thumb{width:28px;height:28px;object-fit:cover;border-radius:4px;flex-shrink:0;}
    .cvx-fchip-name{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1;}
    .cvx-fchip-rm{
      background:none;border:none;padding:0;cursor:pointer;
      color:#94a3b8;font-size:14px;line-height:1;flex-shrink:0;
    }
    .cvx-fchip-rm:hover{color:#ef4444;}
    #cvx-reply-bar{
      display:flex;align-items:flex-end;gap:6px;
      padding:10px 14px;background:white;border-top:1px solid #e9edf2;flex-shrink:0;
    }
    #cvx-attach-btn{
      background:none;border:none;cursor:pointer;padding:4px;
      color:#94a3b8;flex-shrink:0;display:flex;align-items:center;
      border-radius:6px;transition:color .15s,background .15s;
    }
    #cvx-attach-btn:hover{color:${color};background:#f1f5f9;}
    #cvx-attach-btn svg{width:18px;height:18px;}
    #cvx-reply-input{
      flex:1;resize:none;border:1px solid #cbd5e1;border-radius:10px;
      padding:8px 10px;font-size:13px;line-height:1.4;font-family:inherit;
      max-height:80px;outline:none;
    }
    #cvx-reply-input:focus{border-color:${color};}
    #cvx-send-btn{
      background:${color};border:none;color:white;width:36px;height:36px;
      border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;
      flex-shrink:0;transition:background .15s;
    }
    #cvx-send-btn:disabled{opacity:.5;cursor:not-allowed;}
    #cvx-send-btn svg{width:16px;height:16px;fill:white;}
    #cvx-powered{text-align:center;font-size:10px;color:#94a3b8;padding:6px;flex-shrink:0;}
    #cvx-powered a{color:${color};text-decoration:none;}
    #cvx-typing{display:none;align-self:flex-start;}
    #cvx-typing .cvx-dots{display:flex;gap:5px;padding:12px 14px;background:white;border:1px solid #e2e8f0;border-radius:14px 14px 14px 4px;}
    #cvx-typing .cvx-dots span{width:7px;height:7px;background:#94a3b8;border-radius:50%;animation:cvxBounce 1.2s infinite ease-in-out;}
    #cvx-typing .cvx-dots span:nth-child(2){animation-delay:.2s;}
    #cvx-typing .cvx-dots span:nth-child(3){animation-delay:.4s;}
    @keyframes cvxBounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-6px);}}
    @media(max-width:420px){
      #cvx-panel{width:calc(100vw - 24px);max-height:calc(100vh - 90px);border-radius:12px;}
    }
  `;

  var posStyles = position === 'bottom-left' ? 'bottom:24px;left:24px;'   : 'bottom:24px;right:24px;';
  var panelPos  = position === 'bottom-left' ? 'bottom:88px;left:12px;'  : 'bottom:88px;right:12px;';

  // ── DOM ─────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement('div');
  btn.id = 'cvx-widget-btn';
  btn.style.cssText = posStyles;
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/></svg>';
  var badge = document.createElement('div');
  badge.id = 'cvx-widget-badge';
  btn.appendChild(badge);
  document.body.appendChild(btn);

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
    <div id="cvx-messages">
      <div id="cvx-typing"><div class="cvx-dots"><span></span><span></span><span></span></div></div>
    </div>
    <div id="cvx-info-form">
      <input id="cvx-name-input"  type="text"  placeholder="Your name (optional)" />
      <input id="cvx-email-input" type="email" placeholder="Your email (for reply, optional)" />
      <input id="cvx-phone-input" type="tel"   placeholder="Phone number (optional)" />
    </div>
    <div id="cvx-file-preview"></div>
    <div id="cvx-reply-bar">
      <button id="cvx-attach-btn" title="Attach files (max 5, 10MB each)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
        </svg>
      </button>
      <input type="file" id="cvx-file-input" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" style="display:none" />
      <textarea id="cvx-reply-input" rows="1" placeholder="Type a message…"></textarea>
      <button id="cvx-send-btn">
        <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
      </button>
    </div>
    <div id="cvx-powered">Powered by <a href="https://coovex.com" target="_blank">CooVex</a></div>
  `;
  document.body.appendChild(panel);

  var msgContainer  = panel.querySelector('#cvx-messages');
  var typingEl      = panel.querySelector('#cvx-typing');
  var typingTimer   = null;
  var nameInput     = panel.querySelector('#cvx-name-input');
  var emailInput    = panel.querySelector('#cvx-email-input');
  var phoneInput    = panel.querySelector('#cvx-phone-input');
  var replyInput    = panel.querySelector('#cvx-reply-input');
  var sendBtn       = panel.querySelector('#cvx-send-btn');
  var infoForm      = panel.querySelector('#cvx-info-form');
  var filePreview   = panel.querySelector('#cvx-file-preview');
  var fileInput     = panel.querySelector('#cvx-file-input');
  var attachBtn     = panel.querySelector('#cvx-attach-btn');

  if (session.name)  nameInput.value  = session.name;
  if (session.email) emailInput.value = session.email;
  if (session.phone) phoneInput.value = session.phone;
  if (session.conversation_id) infoForm.style.display = 'none';

  // ── Helpers ──────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function saveSession(data) {
    Object.assign(session, data);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
  }

  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + 'KB';
    return (bytes/(1024*1024)).toFixed(1) + 'MB';
  }

  function showTyping(timeoutMs) {
    if (typingTimer) clearTimeout(typingTimer);
    typingEl.style.display = 'flex';
    msgContainer.appendChild(typingEl); // keep at bottom
    msgContainer.scrollTop = msgContainer.scrollHeight;
    typingTimer = setTimeout(hideTyping, timeoutMs || 60000);
  }

  function hideTyping() {
    if (typingTimer) { clearTimeout(typingTimer); typingTimer = null; }
    typingEl.style.display = 'none';
  }

  function addMsg(content, isOut, time, attachments) {
    var d = document.createElement('div');
    var attHtml = '';
    if (attachments && attachments.length) {
      attHtml = '<div class="cvx-msg-attachments">';
      attachments.forEach(function(a) {
        if (a.type && a.type.startsWith('image/')) {
          attHtml += '<a href="' + escHtml(a.url) + '" target="_blank"><img class="cvx-attach-img" src="' + escHtml(a.url) + '" alt="' + escHtml(a.name) + '" /></a>';
        } else {
          attHtml += '<a class="cvx-attach-file" href="' + escHtml(a.url) + '" target="_blank" download>📎 ' + escHtml(a.name) + '</a>';
        }
      });
      attHtml += '</div>';
    }
    d.innerHTML = '<div class="cvx-msg ' + (isOut ? 'cvx-msg-out' : 'cvx-msg-in') + '">' +
      (content ? escHtml(content) : '') + attHtml +
      '<div class="cvx-msg-time">' + (time || 'now') + '</div></div>';
    msgContainer.appendChild(d.firstChild);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function showWelcome() {
    if (!session.welcomed) {
      addMsg(welcome, false);
      saveSession({ welcomed: true });
    }
  }

  function updateFilePreview() {
    filePreview.innerHTML = '';
    if (selectedFiles.length === 0) {
      filePreview.style.display = 'none';
      return;
    }
    filePreview.style.display = 'flex';
    selectedFiles.forEach(function(f, i) {
      var chip = document.createElement('div');
      chip.className = 'cvx-fchip';
      if (f.type.startsWith('image/')) {
        var url = URL.createObjectURL(f);
        chip.innerHTML = '<img class="cvx-fchip-thumb" src="' + url + '" /><span class="cvx-fchip-name">' + escHtml(f.name) + '</span><span style="font-size:10px;color:#94a3b8;flex-shrink:0">' + fmtSize(f.size) + '</span><button class="cvx-fchip-rm" data-idx="' + i + '">&#x2715;</button>';
      } else {
        chip.innerHTML = '<span style="font-size:14px">📎</span><span class="cvx-fchip-name">' + escHtml(f.name) + '</span><span style="font-size:10px;color:#94a3b8;flex-shrink:0">' + fmtSize(f.size) + '</span><button class="cvx-fchip-rm" data-idx="' + i + '">&#x2715;</button>';
      }
      filePreview.appendChild(chip);
    });
    filePreview.querySelectorAll('.cvx-fchip-rm').forEach(function(rmBtn) {
      rmBtn.addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        selectedFiles.splice(idx, 1);
        updateFilePreview();
      });
    });
  }

  // ── Polling for agent replies ─────────────────────────────────────
  function pollMessages() {
    var convId = session.conversation_id;
    if (!convId) return;
    var url = MSGS_API + '?conversation_id=' + encodeURIComponent(convId);
    if (lastMsgTime) url += '&since=' + encodeURIComponent(lastMsgTime);
    fetch(url)
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data || !data.messages) return;
        data.messages.forEach(function(m) {
          if (seenMsgIds[m.id]) return;
          seenMsgIds[m.id] = true;
          lastMsgTime = m.created_at;
          if (m.sender_type !== 'customer') hideTyping();
          // Show badge if panel is hidden
          if (panel.classList.contains('cvx-hidden')) {
            badge.style.display = 'flex';
          }
          addMsg(m.content, false, 'now', m.attachments || []);
        });
      })
      .catch(function() {});
  }

  function startPolling() {
    if (pollTimer) return;
    lastMsgTime = new Date().toISOString();
    pollTimer = setInterval(pollMessages, 4000);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function loadHistory() {
    if (historyLoaded || !session.conversation_id) return;
    historyLoaded = true;
    fetch(MSGS_API + '?conversation_id=' + encodeURIComponent(session.conversation_id))
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data || !data.messages || !data.messages.length) return;
        data.messages.forEach(function(m) {
          if (seenMsgIds[m.id]) return;
          seenMsgIds[m.id] = true;
          var isOut = m.sender_type === 'customer';
          var t = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          addMsg(m.content, isOut, t, m.attachments || []);
          lastMsgTime = m.created_at;
        });
      })
      .catch(function() {});
  }

  // If session already has a conversation, start polling immediately
  if (session.conversation_id) startPolling();

  // ── Events ───────────────────────────────────────────────────────
  btn.addEventListener('click', function() {
    var isHidden = panel.classList.contains('cvx-hidden');
    if (isHidden) {
      panel.classList.remove('cvx-hidden');
      badge.style.display = 'none';
      if (session.conversation_id) {
        loadHistory();
      } else {
        showWelcome();
      }
      replyInput.focus();
    } else {
      panel.classList.add('cvx-hidden');
    }
  });

  panel.querySelector('#cvx-close-btn').addEventListener('click', function() {
    panel.classList.add('cvx-hidden');
  });

  attachBtn.addEventListener('click', function() { fileInput.click(); });

  fileInput.addEventListener('change', function() {
    var newFiles = Array.from(this.files || []);
    var errors = [];
    newFiles.forEach(function(f) {
      if (f.size > MAX_SIZE) { errors.push(f.name + ' exceeds 10MB'); return; }
      if (selectedFiles.length >= MAX_FILES) { errors.push('Max ' + MAX_FILES + ' files'); return; }
      selectedFiles.push(f);
    });
    if (errors.length) alert(errors.join('\n'));
    this.value = '';
    updateFilePreview();
  });

  replyInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  replyInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
  sendBtn.addEventListener('click', doSend);

  function doSend() {
    var msg   = replyInput.value.trim();
    var name  = nameInput.value.trim();
    var email = emailInput.value.trim();
    var phone = phoneInput.value.trim();
    if (!msg && selectedFiles.length === 0) return;

    sendBtn.disabled = true;
    if (msg) addMsg(msg, true);
    if (selectedFiles.length) {
      var attPreview = selectedFiles.map(function(f) { return { name: f.name, type: f.type, url: URL.createObjectURL(f), size: f.size }; });
      addMsg('', true, 'now', attPreview);
    }
    replyInput.value = '';
    replyInput.style.height = 'auto';
    if (name || email || phone) saveSession({ name: name, email: email, phone: phone });

    var files = selectedFiles.slice();
    selectedFiles = [];
    updateFilePreview();

    var hasFiles = files.length > 0;
    var onSuccess = function(data) {
      sendBtn.disabled = false;
      if (data.conversation_id) {
        saveSession({ conversation_id: data.conversation_id });
        infoForm.style.display = 'none';
        startPolling();
      }
      if (data.auto_reply) {
        setTimeout(function() { addMsg(data.auto_reply, false); }, 600);
      }
      if (data.ai_reply_pending && data.conversation_id) {
        showTyping(45000);
        // Trigger AI agent directly from browser (reliable vs server-side after())
        fetch(AGENT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: data.conversation_id }),
        }).catch(function() {});
      }
    };
    var onError = function() {
      sendBtn.disabled = false;
      addMsg('Failed to send. Please try again.', false);
    };

    if (hasFiles) {
      var fd = new FormData();
      fd.append('key', cfg.key);
      if (msg)   fd.append('message', msg);
      if (name)  fd.append('name', name);
      if (email) fd.append('email', email);
      if (phone) fd.append('phone', phone);
      if (session.conversation_id) fd.append('session_id', session.conversation_id);
      fd.append('url', window.location.href);
      files.forEach(function(f) { fd.append('files', f); });
      fetch(API, { method: 'POST', body: fd })
        .then(function(r) { return r.json(); })
        .then(onSuccess).catch(onError);
    } else {
      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: cfg.key, message: msg, name: name || undefined,
          email: email || undefined, phone: phone || undefined,
          session_id: session.conversation_id || undefined,
          url: window.location.href,
        }),
      })
        .then(function(r) { return r.json(); })
        .then(onSuccess).catch(onError);
    }
  }
})();
