/*!
 * panel.goku.codes v1 — drop-in captcha / feedback widget.
 *
 * Default UX: compact pill. Click → floating modal expands. Solve → token.
 * Auto-mounts on any element with [data-panel-sitekey].
 *
 * Usage:
 *   <script src="https://panel.goku.codes/v1.js" defer></script>
 *   <div data-panel-sitekey="pk_demo_a"></div>
 *
 * Programmatic:
 *   const w = Panel.render(el, { site_key, pool, onSolved(token, info) {...} });
 *   w.reset();   // load a new unit
 *   w.destroy();
 *   w.open(); w.close();   // imperatively toggle the modal
 *
 * Modes: data-panel-mode="pill" (default) | "inline" (legacy big iframe)
 *
 * Verification (server-side):
 *   POST https://panel.goku.codes/api/verify  { token }
 */
(function () {
  if (typeof window === 'undefined') return;
  if (window.Panel && window.Panel.__v === 2) return; // idempotent

  function selfOrigin() {
    try {
      var s = document.currentScript || (function () {
        var all = document.getElementsByTagName('script');
        for (var i = all.length - 1; i >= 0; i--) {
          if ((all[i].src || '').indexOf('/v1.js') >= 0) return all[i];
        }
        return null;
      })();
      if (s && s.src) return new URL(s.src).origin;
    } catch (_) {}
    return 'https://panel.goku.codes';
  }
  var ORIGIN = selfOrigin();

  // inject shared styles once
  var STYLE_ID = '__panel_v1_styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = ''
      + '.pnl-pill{display:inline-flex;align-items:center;gap:8px;font:13px/1.2 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;'
      +   'background:#0b1220;color:#e2e8f0;border:1px solid #233040;border-radius:8px;padding:10px 12px;cursor:pointer;user-select:none;'
      +   'transition:border-color .15s ease, background .15s ease;min-width:240px;box-shadow:0 1px 0 rgba(255,255,255,.02) inset}'
      + '.pnl-pill:hover{border-color:#324558;background:#0f1828}'
      + '.pnl-pill[data-state="solved"]{border-color:#22c55e;background:#0d1a14}'
      + '.pnl-pill[data-state="solved"] .pnl-box{border-color:#22c55e;background:#22c55e}'
      + '.pnl-pill[data-state="solved"] .pnl-box::after{content:"";display:block;width:8px;height:5px;border-left:2px solid #0b1220;border-bottom:2px solid #0b1220;transform:rotate(-45deg);position:absolute;top:4px;left:3px}'
      + '.pnl-box{position:relative;width:16px;height:16px;border:1.5px solid #475569;border-radius:3px;background:#0b1220;flex:0 0 auto}'
      + '.pnl-label{flex:1;text-align:left;letter-spacing:.01em}'
      + '.pnl-brand{font:11px/1 ui-sans-serif,system-ui,sans-serif;color:#64748b;letter-spacing:.06em;text-transform:uppercase}'
      + '.pnl-overlay{position:fixed;inset:0;background:rgba(2,6,12,.66);backdrop-filter:blur(3px);z-index:2147483646;display:flex;align-items:center;justify-content:center;animation:pnlFadeIn .15s ease}'
      + '.pnl-modal{position:relative;width:min(460px,calc(100vw - 24px));max-height:calc(100vh - 32px);background:#0a111c;border:1px solid #233040;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,.55);display:flex;flex-direction:column;overflow:hidden;animation:pnlPopIn .18s ease}'
      + '.pnl-modal-hd{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #1c2839;color:#cbd5e1;font:12px/1.2 ui-sans-serif,system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}'
      + '.pnl-x{background:transparent;border:0;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;border-radius:4px}'
      + '.pnl-x:hover{color:#e2e8f0;background:#1c2839}'
      + '.pnl-iframe{width:100%;flex:1 1 auto;min-height:480px;border:0;background:transparent;display:block}'
      + '@keyframes pnlFadeIn{from{opacity:0}to{opacity:1}}'
      + '@keyframes pnlPopIn{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}';
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  function buildSrc(opts) {
    var u = new URL(ORIGIN + '/embed');
    if (opts.site_key) u.searchParams.set('site_key', opts.site_key);
    if (opts.pool) u.searchParams.set('pool', opts.pool);
    u.searchParams.set('h', Math.random().toString(36).slice(2, 8));
    return u.toString();
  }

  function render(el, opts) {
    injectStyles();
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) throw new Error('panel: target element not found');
    opts = opts || {};
    var pool = opts.pool || el.getAttribute('data-panel-pool') || 'public';
    var siteKey = opts.site_key || opts.siteKey || el.getAttribute('data-panel-sitekey') || 'pk_demo_a';
    var mode = opts.mode || el.getAttribute('data-panel-mode') || 'pill';

    el.innerHTML = '';
    el.style.position = el.style.position || 'relative';

    if (mode === 'inline') {
      return renderInline(el, { siteKey: siteKey, pool: pool, opts: opts });
    }
    return renderPill(el, { siteKey: siteKey, pool: pool, opts: opts });
  }

  function makeWidget(siteKey, pool) {
    return {
      __mode: 'pill',
      token: null,
      info: null,
      reset: function () {},
      destroy: function () {},
      open: function () {},
      close: function () {},
    };
  }

  function renderPill(el, ctx) {
    var siteKey = ctx.siteKey, pool = ctx.pool, opts = ctx.opts;
    var pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'pnl-pill';
    pill.setAttribute('data-state', 'idle');
    pill.innerHTML = '<span class="pnl-box"></span><span class="pnl-label">verify you\'re human</span><span class="pnl-brand">panel</span>';
    el.appendChild(pill);

    var widget = makeWidget(siteKey, pool);
    var overlay = null;
    var iframe = null;

    function close() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
      iframe = null;
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    function open() {
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.className = 'pnl-overlay';
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

      var modal = document.createElement('div');
      modal.className = 'pnl-modal';
      modal.innerHTML = '<div class="pnl-modal-hd"><span>panel · feedback</span><button type="button" class="pnl-x" aria-label="close">×</button></div>';
      iframe = document.createElement('iframe');
      iframe.className = 'pnl-iframe';
      iframe.title = 'panel — captcha / feedback';
      iframe.setAttribute('allowtransparency', 'true');
      iframe.scrolling = 'no';
      iframe.src = buildSrc({ site_key: siteKey, pool: pool });
      modal.appendChild(iframe);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      modal.querySelector('.pnl-x').addEventListener('click', close);
      document.addEventListener('keydown', onKey);
    }

    pill.addEventListener('click', function () {
      if (widget.token) return; // already solved
      open();
    });

    function onMsg(ev) {
      if (!ev || !ev.data || typeof ev.data !== 'object') return;
      if (ev.origin !== ORIGIN) return;
      var d = ev.data;
      if (d.type === 'panel:solved' && d.token) {
        widget.token = d.token;
        widget.info = { trust: d.trust };
        pill.setAttribute('data-state', 'solved');
        pill.querySelector('.pnl-label').textContent = 'verified';
        try { if (typeof opts.onSolved === 'function') opts.onSolved(d.token, { trust: d.trust }); } catch (_) {}
        try { el.dispatchEvent(new CustomEvent('panel:solved', { detail: { token: d.token, trust: d.trust }, bubbles: true })); } catch (_) {}
        setTimeout(close, 350);
      }
    }
    window.addEventListener('message', onMsg);

    widget.reset = function () {
      widget.token = null; widget.info = null;
      pill.setAttribute('data-state', 'idle');
      pill.querySelector('.pnl-label').textContent = 'verify you\'re human';
      close();
    };
    widget.destroy = function () {
      window.removeEventListener('message', onMsg);
      close();
      try { el.removeChild(pill); } catch (_) {}
    };
    widget.open = open;
    widget.close = close;
    return widget;
  }

  function renderInline(el, ctx) {
    var siteKey = ctx.siteKey, pool = ctx.pool, opts = ctx.opts;
    var iframe = document.createElement('iframe');
    iframe.src = buildSrc({ site_key: siteKey, pool: pool });
    iframe.title = 'panel — captcha / feedback';
    iframe.setAttribute('allowtransparency', 'true');
    iframe.style.cssText = 'width:100%;min-height:420px;border:0;background:transparent;display:block;border-radius:10px';
    iframe.scrolling = 'no';
    el.appendChild(iframe);
    var widget = makeWidget(siteKey, pool);
    widget.__mode = 'inline';
    function onMsg(ev) {
      if (!ev || !ev.data || typeof ev.data !== 'object') return;
      if (ev.origin !== ORIGIN) return;
      var d = ev.data;
      if (d.type === 'panel:solved' && d.token) {
        widget.token = d.token;
        widget.info = { trust: d.trust };
        try { if (typeof opts.onSolved === 'function') opts.onSolved(d.token, { trust: d.trust }); } catch (_) {}
        try { el.dispatchEvent(new CustomEvent('panel:solved', { detail: { token: d.token, trust: d.trust }, bubbles: true })); } catch (_) {}
      }
    }
    window.addEventListener('message', onMsg);
    widget.reset = function () { iframe.src = buildSrc({ site_key: siteKey, pool: pool }); widget.token = null; widget.info = null; };
    widget.destroy = function () { window.removeEventListener('message', onMsg); try { el.removeChild(iframe); } catch (_) {} };
    return widget;
  }

  function autoMount() {
    var els = document.querySelectorAll('[data-panel-sitekey]:not([data-panel-mounted])');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      el.setAttribute('data-panel-mounted', '1');
      render(el, {
        site_key: el.getAttribute('data-panel-sitekey'),
        pool: el.getAttribute('data-panel-pool') || 'public',
        mode: el.getAttribute('data-panel-mode') || 'pill',
      });
    }
  }

  var Panel = {
    __v: 2,
    origin: ORIGIN,
    render: render,
    autoMount: autoMount,
  };
  window.Panel = Panel;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }
})();
