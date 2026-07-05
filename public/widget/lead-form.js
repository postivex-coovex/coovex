(function () {
  'use strict';
  var script = document.currentScript;
  var webhookUrl = script && script.getAttribute('data-webhook');
  if (!webhookUrl) { console.warn('[CooVex] data-webhook attribute missing'); return; }

  var label = script.getAttribute('data-label') || 'Contact Us';
  var submitText = script.getAttribute('data-submit') || 'Send Message';
  var accentColor = script.getAttribute('data-color') || '#7c3aed';

  // Inject styles
  var style = document.createElement('style');
  style.textContent = [
    '.pvx-form{font-family:system-ui,-apple-system,sans-serif;max-width:480px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.06);}',
    '.pvx-form h3{margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a;}',
    '.pvx-form label{display:block;font-size:13px;font-weight:500;color:#475569;margin-bottom:4px;}',
    '.pvx-form input,.pvx-form textarea{width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:14px;color:#0f172a;background:#f8fafc;margin-bottom:12px;outline:none;transition:border-color .15s;}',
    '.pvx-form input:focus,.pvx-form textarea:focus{border-color:VAR_COLOR;background:#fff;}',
    '.pvx-form textarea{min-height:80px;resize:vertical;}',
    '.pvx-form button{width:100%;padding:12px;background:VAR_COLOR;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .15s;}',
    '.pvx-form button:hover{opacity:.88;}',
    '.pvx-form button:disabled{opacity:.5;cursor:default;}',
    '.pvx-msg{margin-top:12px;padding:10px 14px;border-radius:8px;font-size:13px;text-align:center;}',
    '.pvx-msg.ok{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;}',
    '.pvx-msg.err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;}',
  ].join('').replace(/VAR_COLOR/g, accentColor);
  document.head.appendChild(style);

  // Build form HTML
  var container = document.createElement('div');
  container.className = 'pvx-form';
  container.innerHTML = [
    '<h3>' + label + '</h3>',
    '<label>Your Name *</label><input type="text" name="name" placeholder="Jane Smith" required>',
    '<label>Email *</label><input type="email" name="email" placeholder="jane@company.com" required>',
    '<label>Phone</label><input type="tel" name="phone" placeholder="+1 555-0100">',
    '<label>Company</label><input type="text" name="company" placeholder="Acme Corp">',
    '<label>Message</label><textarea name="message" placeholder="How can we help?"></textarea>',
    '<button type="button">' + submitText + '</button>',
    '<div class="pvx-msg" style="display:none"></div>',
  ].join('');

  // Replace script tag with form
  script.parentNode.replaceChild(container, script);

  var btn = container.querySelector('button');
  var msg = container.querySelector('.pvx-msg');

  btn.addEventListener('click', function () {
    var get = function (n) { return (container.querySelector('[name=' + n + ']').value || '').trim(); };
    var name = get('name'), email = get('email');
    if (!name || !email) { showMsg('Please fill in Name and Email.', false); return; }

    btn.disabled = true;
    btn.textContent = 'Sending…';
    msg.style.display = 'none';

    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email, phone: get('phone'), company: get('company'), message: get('message') }),
    })
    .then(function (r) {
      if (!r.ok) throw new Error('Server error');
      showMsg('Thank you! We\'ll be in touch soon.', true);
      container.querySelectorAll('input, textarea').forEach(function (el) { el.value = ''; });
    })
    .catch(function () { showMsg('Something went wrong. Please try again.', false); })
    .finally(function () { btn.disabled = false; btn.textContent = submitText; });
  });

  function showMsg(text, ok) {
    msg.textContent = text;
    msg.className = 'pvx-msg ' + (ok ? 'ok' : 'err');
    msg.style.display = 'block';
  }
})();
