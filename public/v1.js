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
      // floating popover anchored to the pill — no modal chrome, just the panel iframe in a shadowed card.
      // panel's /embed page is already self-styled so we don't re-wrap it.
      + '.pnl-pop{position:fixed;z-index:2147483646;width:min(460px,calc(100vw - 24px));max-height:min(620px,calc(100vh - 32px));'
      +   'background:#0a111c;border:1px solid #233040;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,.55);overflow:hidden;'
      +   'display:flex;flex-direction:column;animation:pnlPopIn .15s ease}'
      + '.pnl-pop-iframe{width:100%;flex:1 1 auto;min-height:520px;border:0;background:transparent;display:block;overflow:auto}'
      + '.pnl-pop[data-state="closing"]{transition:opacity .22s ease, transform .22s ease;opacity:0;transform:translateY(-2px) scale(.92);pointer-events:none}'
      + '@keyframes pnlPopIn{from{opacity:0;transform:translateY(4px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}';
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
    var pop = null;
    var iframe = null;

    function close() {
      if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
      pop = null;
      iframe = null;
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    }
    // NB: no Esc-to-close, no outside-click-to-close, no second-click-to-close.
    // a captcha that lets the visitor abort+reroll a fresh question on every
    // outside click is a free way to farm easier questions, so once the popover
    // is open we keep it open until it resolves (solved → fade) or until the
    // host page calls widget.close() programmatically. lock-in is the point.
    function position() {
      if (!pop) return;
      var r = pill.getBoundingClientRect();
      var w = pop.offsetWidth || 460;
      var h = pop.offsetHeight || 540;
      var pad = 8;
      // prefer below; flip above if not enough room
      var top = r.bottom + pad;
      if (top + h > window.innerHeight - pad) {
        top = Math.max(pad, r.top - h - pad);
      }
      // align left edges; clamp inside viewport
      var left = r.left;
      if (left + w > window.innerWidth - pad) left = window.innerWidth - w - pad;
      if (left < pad) left = pad;
      pop.style.top = top + 'px';
      pop.style.left = left + 'px';
    }

    function open() {
      if (pop) return;
      pop = document.createElement('div');
      pop.className = 'pnl-pop';
      pop.style.top = '-9999px';
      pop.style.left = '-9999px';
      iframe = document.createElement('iframe');
      iframe.className = 'pnl-pop-iframe';
      iframe.title = 'panel — captcha / feedback';
      iframe.setAttribute('allowtransparency', 'true');
      iframe.setAttribute('scrolling', 'auto');
      iframe.src = buildSrc({ site_key: siteKey, pool: pool });
      pop.appendChild(iframe);
      document.body.appendChild(pop);
      // measure then position
      requestAnimationFrame(position);
      window.addEventListener('resize', position);
      window.addEventListener('scroll', position, true);
    }

    pill.addEventListener('click', function () {
      if (widget.token) return; // already solved
      if (pop) return;          // already open — no toggle-close (anti-reroll)
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
        // let the user actually see the "verified" success state inside the
        // iframe before tearing it down. linger ~1.1s, then shrink-fade close.
        if (pop) {
          setTimeout(function () {
            if (!pop) return;
            pop.setAttribute('data-state', 'closing');
            setTimeout(close, 240);
          }, 1100);
        }
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
