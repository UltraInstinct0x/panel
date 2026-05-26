/*!
 * panel.goku.codes v1 — drop-in captcha / feedback widget.
 *
 * WS-P: visible-invisible tier ladder (C0/C1/C2/C3).
 *   - pill renders for everyone (visible)
 *   - clean traffic gets C0: passive fingerprint → auto-resolve animation, no popover
 *   - escalation (C1/C2/C3) opens the anchored popover with same-set retry semantics (D19)
 *   - panel-native animation: thin cyan scanline sweep across the pill that resolves
 *     into a small diamond glyph + lowercase "verified" caption. ~1200ms, one-shot.
 *     explicitly NOT the turnstile fade or recaptcha checkmark.
 *
 * Usage:
 *   <script src="https://panel.goku.codes/v1.js" defer></script>
 *   <div data-panel-sitekey="pk_demo_a"></div>
 *
 * Programmatic:
 *   const w = Panel.render(el, { site_key, pool, onSolved({ token, trust, tier_used }){...} });
 *   w.reset(); w.destroy(); w.open(); w.close();
 *
 * Modes:
 *   data-panel-mode="pill"   (default — WS-P visible-invisible)
 *   data-panel-mode="inline" (legacy big iframe)
 *   data-panel-force-tier="C1|C2|C3"  (demo/debug — skip C0)
 *
 * Verification (server-side):
 *   POST https://panel.goku.codes/api/verify  { token }
 */
(function () {
  if (typeof window === 'undefined') return;
  if (window.Panel && window.Panel.__v === 3) return; // idempotent

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
  var EDGE_MODEL_DEFAULT = {
    local_score: null,
    local_class_probs: {},
    reason_codes: ['edge_model_scaffold'],
    model_version: 'edge-risk-v1-scaffold',
    feature_version: 'v1',
    runtime: 'rules_only',
    model_error: false,
  };

  // ---------- styles ----------
  // dark linear-app palette: #08080b bg, #67e8f9 cyan, inter+jb-mono.
  // animation primitive: a thin cyan scanline sweeps the pill, then crystallizes
  // into a diamond glyph rotated 45deg. inner glow ramps in over final 300ms.
  var STYLE_ID = '__panel_v1_styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = ''
      + '.pnl-pill{position:relative;display:inline-flex;align-items:center;gap:10px;'
      +   'font:13px/1.2 "Inter",ui-sans-serif,system-ui,-apple-system,sans-serif;'
      +   'background:#0c0c12;color:#e2e8f0;border:1px solid #1f2230;border-radius:10px;'
      +   'padding:11px 14px;cursor:pointer;user-select:none;'
      +   'transition:border-color .2s ease, background .2s ease, width .4s cubic-bezier(.4,0,.2,1);'
      +   'min-width:240px;overflow:hidden;box-shadow:0 1px 0 rgba(255,255,255,.02) inset}'
      + '.pnl-pill:hover{border-color:#2a3144;background:#10111a}'
      + '.pnl-pill[data-mode="c0"]{cursor:default}'
      + '.pnl-pill[data-state="scanning"]{border-color:#67e8f9}'
      + '.pnl-pill[data-state="verified"]{border-color:#67e8f9;background:#0a1418;'
      +   'box-shadow:0 0 0 1px rgba(103,232,249,.2) inset, 0 0 24px -8px rgba(103,232,249,.35)}'
      + '.pnl-box{position:relative;width:16px;height:16px;border:1.5px solid #475569;border-radius:3px;background:#0b1220;flex:0 0 auto;'
      +   'transition:border-color .2s ease, background .2s ease}'
      + '.pnl-pill[data-state="scanning"] .pnl-box{border-color:#67e8f9}'
      + '.pnl-pill[data-state="verified"] .pnl-box{border:0;background:transparent}'
      + '.pnl-glyph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;'
      +   'opacity:0;transform:scale(.6) rotate(45deg);transition:opacity .3s ease, transform .3s cubic-bezier(.4,0,.2,1)}'
      + '.pnl-pill[data-state="verified"] .pnl-glyph{opacity:1;transform:scale(1) rotate(45deg)}'
      + '.pnl-glyph svg{display:block}'
      + '.pnl-pill[data-trust-state="high"][data-state="verified"]{border-color:#4ade80;background:#0a1a0f;'
      +   'box-shadow:0 0 0 1px rgba(74,222,128,.2) inset, 0 0 24px -8px rgba(74,222,128,.35)}'
      + '.pnl-pill[data-trust-state="high"][data-state="verified"] .pnl-brand{color:#4ade80}'
      + '.pnl-pill[data-trust-state="high"][data-state="verified"] .pnl-caption{color:#4ade80}'
      + '.pnl-pill[data-trust-state="low"][data-state="verified"]{border-color:#f59e0b;background:#1a1408;'
      +   'box-shadow:0 0 0 1px rgba(245,158,11,.2) inset, 0 0 24px -8px rgba(245,158,11,.25)}'
      + '.pnl-pill[data-trust-state="low"][data-state="verified"] .pnl-brand{color:#f59e0b}'
      + '.pnl-pill[data-trust-state="low"][data-state="verified"] .pnl-caption{color:#f59e0b}'
      + '.pnl-pill[data-trust-state="blocked"][data-state="verified"]{border-color:#28282c;background:#0a0a0c;'
      +   'box-shadow:0 0 0 1px rgba(255,255,255,.08) inset}'
      + '.pnl-pill[data-trust-state="blocked"][data-state="verified"] .pnl-brand{color:#52525b}'
      + '.pnl-pill[data-trust-state="blocked"][data-state="verified"] .pnl-caption{color:#52525b}'
      + '.pnl-label{flex:1;text-align:left;letter-spacing:.01em;font-feature-settings:"ss01"}'
      + '.pnl-brand{font:11px/1 "JetBrains Mono",ui-monospace,monospace;color:#52525b;letter-spacing:.08em;text-transform:lowercase}'
      + '.pnl-pill[data-state="verified"] .pnl-brand{color:#67e8f9}'
      // scanline: a thin vertical bar of cyan light sweeping left→right.
      // exists only during the [data-state="scanning"] window. self-removes via animation-end.
      + '.pnl-scan{position:absolute;top:0;bottom:0;width:2px;background:linear-gradient(to bottom,transparent,#67e8f9,transparent);'
      +   'box-shadow:0 0 8px #67e8f9, 0 0 14px rgba(103,232,249,.4);opacity:0;pointer-events:none;left:-2px}'
      + '.pnl-pill[data-state="scanning"] .pnl-scan{opacity:1;animation:pnlScan 900ms cubic-bezier(.45,.05,.55,.95) forwards}'
      + '@keyframes pnlScan{0%{left:-2px;opacity:0}10%{opacity:1}90%{opacity:1}100%{left:100%;opacity:0}}'
      // caption: a sub-label that crossfades from "verifying" → "verified by the panel".
      // mono font, smaller, dimmed cyan.
      + '.pnl-caption{position:absolute;left:14px;right:14px;bottom:-18px;font:10px/1 "JetBrains Mono",ui-monospace,monospace;'
      +   'color:#52525b;letter-spacing:.06em;opacity:0;transition:opacity .25s ease;text-transform:lowercase;pointer-events:none}'
      + '.pnl-pill[data-state="verified"] .pnl-caption{opacity:1;color:#67e8f9}'
      // popover — used for C1/C2/C3 only.
      + '.pnl-pop{position:fixed;z-index:2147483646;width:min(460px,calc(100vw - 24px));max-height:min(620px,calc(100vh - 32px));'
      +   'background:#08080b;border:1px solid #1f2230;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,.7);overflow:hidden;'
      +   'display:flex;flex-direction:column;animation:pnlPopIn .15s ease}'
      + '.pnl-pop-iframe{width:100%;flex:1 1 auto;min-height:520px;border:0;background:transparent;display:block;overflow:auto}'
      + '.pnl-pop-retry{font:11px/1.4 "JetBrains Mono",ui-monospace,monospace;color:#a3a3a3;padding:8px 12px;border-bottom:1px solid #1f2230;background:#0c0c12;display:none}'
      + '.pnl-pop[data-show-retry="1"] .pnl-pop-retry{display:block}'
      + '.pnl-pop[data-state="closing"]{transition:opacity .22s ease, transform .22s ease;opacity:0;transform:translateY(-2px) scale(.92);pointer-events:none}'
      + '@keyframes pnlPopIn{from{opacity:0;transform:translateY(4px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}';
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---------- passive fingerprint collector ----------
  // attaches once globally; per-widget snapshot taken at init + at resolve.
  // does NOT capture key contents — counts only.
  function startCollector(el) {
    var fp = {
      mouse_samples: [],   // [{t,x,y}]
      scroll_samples: [],  // [{t,dy}]
      focus_events: 0,
      blur_events: 0,
      key_events: 0,
      visibility_changes: 0,
      pointer_type: 'unknown',
      _start: Date.now(),
    };
    var lastMouse = 0, lastScroll = 0;
    function onMouse(e) {
      var now = Date.now();
      if (now - lastMouse < 40) return; // ~25 hz cap
      lastMouse = now;
      fp.mouse_samples.push({ t: now, x: e.clientX, y: e.clientY });
      if (fp.mouse_samples.length > 200) fp.mouse_samples.shift();
    }
    function onScroll() {
      var now = Date.now();
      if (now - lastScroll < 60) return;
      lastScroll = now;
      fp.scroll_samples.push({ t: now, dy: window.scrollY });
      if (fp.scroll_samples.length > 50) fp.scroll_samples.shift();
    }
    function onFocus() { fp.focus_events++; }
    function onBlur() { fp.blur_events++; }
    function onKey() { fp.key_events++; }
    function onVis() { fp.visibility_changes++; }
    function onPointer(e) { if (e.pointerType) fp.pointer_type = e.pointerType; }
    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('focus', onFocus, true);
    window.addEventListener('blur', onBlur, true);
    window.addEventListener('keydown', onKey, { passive: true });
    document.addEventListener('visibilitychange', onVis, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
    return {
      snapshot: function (dwellMs) {
        return {
          mouse_samples: fp.mouse_samples.slice(),
          scroll_samples: fp.scroll_samples.slice(),
          focus_events: fp.focus_events,
          blur_events: fp.blur_events,
          key_events: fp.key_events,
          visibility_changes: fp.visibility_changes,
          pointer_type: fp.pointer_type,
          dwell_ms: dwellMs != null ? dwellMs : Date.now() - fp._start,
        };
      },
      destroy: function () {
        window.removeEventListener('mousemove', onMouse);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('focus', onFocus, true);
        window.removeEventListener('blur', onBlur, true);
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('pointerdown', onPointer);
      },
    };
  }

  // ---------- render ----------
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
    var forceTier = opts.force_tier || el.getAttribute('data-panel-force-tier') || null;
    var bootDelayMs = Number(opts.boot_delay_ms || el.getAttribute('data-panel-boot-delay-ms') || 2500);

    el.innerHTML = '';
    el.style.position = el.style.position || 'relative';

    if (mode === 'inline') return renderInline(el, { siteKey: siteKey, pool: pool, opts: opts });
    return renderPill(el, { siteKey: siteKey, pool: pool, opts: opts, forceTier: forceTier, bootDelayMs: bootDelayMs });
  }

  // ---------- stateful SVG identity system ----------
  // extracted from docs/assets/panel_tier_orbit_asset_suite.html
  // five trust states with distinct geometric transformations:
  // - initial: dormant tiny dot (opacity 0.4)
  // - standard: rotating inner diamond (opacity 1.0, active calibration)
  // - high: solid center dot (opacity 1.0, verified lock)
  // - low: bifurcated core (two dots, human fallback)
  // - blocked: fractured outer boundary, empty core
  var stateColorMap = {
    initial: {
      accentColor: '#67e8f9',
      baseOpacity: '0.4',
    },
    standard: {
      accentColor: '#67e8f9',
      baseOpacity: '1.0',
    },
    high: {
      accentColor: '#4ade80',
      baseOpacity: '1.0',
    },
    low: {
      accentColor: '#f59e0b',
      baseOpacity: '0.9',
    },
    blocked: {
      accentColor: '#28282c',
      baseOpacity: '0.4',
    }
  };

  // Render 20px pill icon (32x32 viewBox, 20px displayed size)
  function renderPillIconSVG(state) {
    var map = stateColorMap[state];
    var acc = map.accentColor;
    var outerColor = state === 'blocked' ? 'rgba(255, 255, 255, 0.2)' : acc;
    var op = map.baseOpacity;
    var fOuterFrame = '';
    var fCore = '';

    if (state === 'blocked') {
      fOuterFrame = '<path d="M 14.5 11.5 L 16 10 L 17.5 11.5" stroke="' + outerColor + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />'
        + '<path d="M 20.5 14.5 L 22 16 L 20.5 17.5" stroke="' + outerColor + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />'
        + '<path d="M 17.5 20.5 L 16 22 L 14.5 20.5" stroke="' + outerColor + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />'
        + '<path d="M 11.5 17.5 L 10 16 L 11.5 14.5" stroke="' + outerColor + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />';
      fCore = '';
    } else {
      fOuterFrame = '<rect x="11.5" y="11.5" width="9" height="9" rx="1.5" transform="rotate(45 16 16)" stroke="' + outerColor + '" stroke-width="1.5" fill="none" opacity="' + op + '" />';
      if (state === 'initial') {
        fCore = '<circle cx="16" cy="16" r="1" fill="' + acc + '" opacity="' + op + '" />';
      } else if (state === 'standard') {
        fCore = '<rect x="14" y="14" width="4" height="4" rx="0.5" transform="rotate(15 16 16)" stroke="' + acc + '" stroke-width="1" fill="none" />';
      } else if (state === 'high') {
        fCore = '<circle cx="16" cy="16" r="2" fill="' + acc + '" />';
      } else if (state === 'low') {
        fCore = '<circle cx="14" cy="16" r="1" fill="' + acc + '" />'
          + '<circle cx="18" cy="16" r="1" fill="' + acc + '" />';
      }
    }

    return '<svg viewBox="0 0 32 32" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">'
      + fOuterFrame + fCore
      + '</svg>';
  }

  // Render favicon (64px, 32px, or 16px)
  function renderFaviconSVG(state, size) {
    var map = stateColorMap[state];
    var acc = map.accentColor;
    var op = map.baseOpacity;
    var sizePx = size === '64' ? 64 : size === '32' ? 32 : 16;
    var outerColor = state === 'blocked' ? 'rgba(255,255,255,0.2)' : acc;
    var fOuterFrame = '';
    var fCore = '';

    if (state === 'blocked') {
      fOuterFrame = '<path d="M 14.5 11.5 L 16 10 L 17.5 11.5" stroke="' + outerColor + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />'
        + '<path d="M 20.5 14.5 L 22 16 L 20.5 17.5" stroke="' + outerColor + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />'
        + '<path d="M 17.5 20.5 L 16 22 L 14.5 20.5" stroke="' + outerColor + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />'
        + '<path d="M 11.5 17.5 L 10 16 L 11.5 14.5" stroke="' + outerColor + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />';
      fCore = '';
    } else {
      fOuterFrame = '<rect x="11.5" y="11.5" width="9" height="9" rx="1.5" transform="rotate(45 16 16)" stroke="' + outerColor + '" stroke-width="1.5" fill="none" opacity="' + op + '" />';
      if (state === 'initial') {
        fCore = '<circle cx="16" cy="16" r="1" fill="' + acc + '" opacity="' + op + '" />';
      } else if (state === 'standard') {
        fCore = '<rect x="14" y="14" width="4" height="4" rx="0.5" transform="rotate(15 16 16)" stroke="' + acc + '" stroke-width="1" fill="none" />';
      } else if (state === 'high') {
        fCore = '<circle cx="16" cy="16" r="2" fill="' + acc + '" />';
      } else if (state === 'low') {
        fCore = '<circle cx="14" cy="16" r="1" fill="' + acc + '" />'
          + '<circle cx="18" cy="16" r="1" fill="' + acc + '" />';
      }
    }

    return '<svg viewBox="0 0 32 32" width="' + sizePx + '" height="' + sizePx + '" fill="none" xmlns="http://www.w3.org/2000/svg">'
      + '<rect x="1" y="1" width="30" height="30" rx="5" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" fill="#0f1011"/>'
      + fOuterFrame
      + '<g id="mini-core-content">' + fCore + '</g>'
      + '</svg>';
  }

  // Render full primary SVG (560x140 viewBox - for app icon / brand lockup)
  function renderStatefulSVG(state) {
    var map = stateColorMap[state];
    var acc = map.accentColor;
    var op = map.baseOpacity;
    var outerColor = state === 'blocked' ? 'rgba(255, 255, 255, 0.2)' : acc;
    var frameGeometry = '';
    var coreContent = '';

    if (state === 'blocked') {
      // Fractured diamond (calculated from 60,60 radius)
      frameGeometry = '<path d="M 54 40 L 60 34 L 66 40" stroke="' + outerColor + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />'
        + '<path d="M 80 54 L 86 60 L 80 66" stroke="' + outerColor + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />'
        + '<path d="M 66 80 L 60 86 L 54 80" stroke="' + outerColor + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />'
        + '<path d="M 40 66 L 34 60 L 40 54" stroke="' + outerColor + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />';
      coreContent = '';
    } else {
      // Solid pristine diamond
      frameGeometry = '<rect x="42" y="42" width="36" height="36" rx="3" transform="rotate(45 60 60)" stroke="' + outerColor + '" stroke-width="3" opacity="' + op + '" fill="none" />';
      if (state === 'initial') {
        // Dormant tiny dot
        coreContent = '<circle cx="60" cy="60" r="2.5" fill="' + acc + '" opacity="' + op + '" />';
      } else if (state === 'standard') {
        // Active inner spinning alignment phase
        coreContent = '<rect x="52" y="52" width="16" height="16" rx="1.5" transform="rotate(15 60 60)" stroke="' + acc + '" stroke-width="2.5" fill="none" />';
      } else if (state === 'high') {
        // Absolute locked geometry
        coreContent = '<circle cx="60" cy="60" r="6" fill="' + acc + '" />';
      } else if (state === 'low') {
        // Bifurcated core (human fallback required)
        coreContent = '<circle cx="53" cy="60" r="4" fill="' + acc + '" />'
          + '<circle cx="67" cy="60" r="4" fill="' + acc + '" />';
      }
    }

    return '<svg id="primary-lockup-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 140" width="100%" height="100%" fill="none">'
      + '<defs>'
      + '<style>'
      + '.brand-text { font-family: "Inter", -apple-system, sans-serif; font-weight: 700; font-size: 64px; fill: #f7f8f8; letter-spacing: -0.05em; font-feature-settings: "cv01" on, "ss03" on; }'
      + '.metadata-text { font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 11px; fill: #8a8f98; letter-spacing: 0.08em; }'
      + '</style>'
      + '</defs>'
      + '<g id="phase-alignment" transform="translate(10, 10)">'
      + '<rect x="4" y="4" width="112" height="112" rx="12" stroke="rgba(255, 255, 255, 0.08)" stroke-width="2" fill="#0f1011"/>'
      + frameGeometry
      + '<g id="shutter-core-content" style="transition: all 0.25s ease;">'
      + coreContent
      + '</g>'
      + '<circle cx="104" cy="104" r="2.5" fill="' + (map.accentColor === '#28282c' ? '#8a8f98' : acc) + '" opacity="0.4"/>'
      + '</g>'
      + '<g transform="translate(156, 12)">'
      + '<text x="0" y="68" class="brand-text">panel</text>'
      + '<text x="3" y="96" class="metadata-text">INVISIBLE CAPTCHA &amp; AGENT GOVERNANCE</text>'
      + '</g>'
      + '</svg>';
  }

  // Legacy GLYPH_SVG — now replaced by renderPillIconSVG('standard')
  // kept for backward compat if anything references it directly
  var GLYPH_SVG = renderPillIconSVG('standard');

  function renderPill(el, ctx) {
    var siteKey = ctx.siteKey, pool = ctx.pool, opts = ctx.opts, forceTier = ctx.forceTier, bootDelayMs = Number(ctx.bootDelayMs || 2500);
    var pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'pnl-pill';
    pill.setAttribute('data-state', 'idle');
    pill.innerHTML = ''
      + '<span class="pnl-scan"></span>'
      + '<span class="pnl-box"><span class="pnl-glyph">' + GLYPH_SVG + '</span></span>'
      + '<span class="pnl-label">verify you\'re human</span>'
      + '<span class="pnl-brand">panel</span>'
      + '<span class="pnl-caption">verified by the panel</span>';
    el.appendChild(pill);

    var collector = startCollector(el);
    var widget = {
      __mode: 'pill',
      __v: 3,
      token: null,
      info: null,
      tier_used: null,
      reset: function () {},
      destroy: function () {},
      open: function () {},
      close: function () {},
    };
    var pop = null;
    var iframe = null;
    var challengeToken = null;
    var raterId = null;
    var currentTier = null;
    var lastInitResp = null;
    var currentTrustState = 'initial';

    function updatePillIcon(trustState) {
      currentTrustState = trustState;
      pill.setAttribute('data-trust-state', trustState);
      var glyphEl = pill.querySelector('.pnl-glyph');
      if (glyphEl) {
        glyphEl.innerHTML = renderPillIconSVG(trustState);
      }
    }

    function fireSolved(token, trust, tier_used) {
      widget.token = token;
      widget.info = { trust: trust, tier_used: tier_used };
      widget.tier_used = tier_used;
      pill.setAttribute('data-mode', 'c0');
      pill.setAttribute('data-state', 'verified');
      var trustState = trust === 'high' ? 'high' : trust === 'low' ? 'low' : trust === 'standard' ? 'standard' : 'high';
      updatePillIcon(trustState);
      try { pill.querySelector('.pnl-label').textContent = 'verified'; } catch (_) {}
      try { if (typeof opts.onSolved === 'function') opts.onSolved({ token: token, trust: trust, tier_used: tier_used }); } catch (_) {}
      try { el.dispatchEvent(new CustomEvent('panel:solved', { detail: { token: token, trust: trust, tier_used: tier_used }, bubbles: true })); } catch (_) {}
    }

    function playC0Animation(then) {
      updatePillIcon('standard');
      pill.querySelector('.pnl-label').textContent = 'verifying';
      pill.setAttribute('data-state', 'scanning');
      setTimeout(function () {
        updatePillIcon('high');
        pill.setAttribute('data-state', 'verified');
        pill.querySelector('.pnl-label').textContent = 'verified';
        setTimeout(then, 300);
      }, 900);
    }

    function postInit(extraBody) {
      var body = Object.assign({
        site_key: siteKey,
        pool: pool,
        fingerprint: collector.snapshot(),
        fingerprint_id: getFpId(),
        session_age_ms: Date.now() - collector.snapshot(0).dwell_ms ? 1 : 0,
      }, extraBody || {});
      return fetch(ORIGIN + '/api/challenge/init?site_key=' + encodeURIComponent(siteKey), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-panel-site-key': siteKey },
        body: JSON.stringify(body),
      }).then(function (r) { return r.json(); });
    }

    function postResolveC0() {
      return fetch(ORIGIN + '/api/challenge/resolve?site_key=' + encodeURIComponent(siteKey), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-panel-site-key': siteKey },
        body: JSON.stringify({
          challenge_token: challengeToken,
          fingerprint: collector.snapshot(),
          edge_model: EDGE_MODEL_DEFAULT,
        }),
      }).then(function (r) { return r.json(); });
    }

    function openPopoverWith(initResp) {
      // C1/C2/C3 path. anchored popover, locked open until resolve or destroy.
      if (pop) return;
      pop = document.createElement('div');
      pop.className = 'pnl-pop';
      pop.style.top = '-9999px';
      pop.style.left = '-9999px';
      var retry = document.createElement('div');
      retry.className = 'pnl-pop-retry';
      retry.textContent = 'tier ' + initResp.tier.toLowerCase() + ' — attempt 1 of ' + initResp.max_attempts;
      // C0/C1 don't show counter (spec: don't broadcast retry-able to attackers)
      if (initResp.tier === 'C2' || initResp.tier === 'C3') {
        pop.setAttribute('data-show-retry', '1');
      }
      pop.appendChild(retry);
      iframe = document.createElement('iframe');
      iframe.className = 'pnl-pop-iframe';
      iframe.title = 'panel — captcha / feedback';
      iframe.setAttribute('allowtransparency', 'true');
      iframe.setAttribute('scrolling', 'auto');
      iframe.src = buildSrc({ site_key: siteKey, pool: pool });
      pop.appendChild(iframe);
      document.body.appendChild(pop);
      requestAnimationFrame(position);
      window.addEventListener('resize', position);
      window.addEventListener('scroll', position, true);
    }

    function position() {
      if (!pop) return;
      var r = pill.getBoundingClientRect();
      var w = pop.offsetWidth || 460;
      var h = pop.offsetHeight || 540;
      var pad = 8;
      var top = r.bottom + pad;
      if (top + h > window.innerHeight - pad) top = Math.max(pad, r.top - h - pad);
      var left = r.left;
      if (left + w > window.innerWidth - pad) left = window.innerWidth - w - pad;
      if (left < pad) left = pad;
      pop.style.top = top + 'px'; pop.style.left = left + 'px';
    }

    function closePop() {
      if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
      pop = null; iframe = null;
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    }

    // ---------- bootstrap ----------
    // wait 2.5s for behavioral signals to accumulate (the spec floor).
    // if force_tier set, skip the gate and request that tier directly.
    function bootstrap() {
      var initBody = forceTier ? { _debug_force_tier: forceTier } : {};
      postInit(initBody).then(function (resp) {
        if (!resp || !resp.tier) return;
        challengeToken = resp.challenge_token;
        raterId = resp.rater_id;
        currentTier = forceTier || resp.tier;
        lastInitResp = resp;

        if (currentTier === 'C0') {
          // animate + auto-resolve
          playC0Animation(function () {
            postResolveC0().then(function (rr) {
              if (rr && rr.success) {
                fireSolved(rr.token, rr.trust, 'C0');
              } else {
                // C0 failed (dwell/trust floor) → escalate to C1 immediately
                escalateTo('C1');
              }
            }).catch(function () { escalateTo('C1'); });
          });
        } else {
          // C1 edge-case: wait for click before opening challenge.
          // click acts as extra passive signal; we re-init once before showing a question.
          if (currentTier === 'C1') {
            pill.querySelector('.pnl-label').textContent = 'tap to finish verify';
          } else {
            // C2/C3: do not auto-open. explicit user click invokes challenge.
            pill.querySelector('.pnl-label').textContent = 'tap to verify (' + currentTier.toLowerCase() + ')';
          }
        }
      }).catch(function () {
        // hard fallback: open inline popover with whatever the embed page renders
        pill.querySelector('.pnl-label').textContent = 'verify you\'re human';
      });
    }

    function escalateTo(tier) {
      // continuous escalation — no popover rip. pill pulses then opens.
      pill.setAttribute('data-state', 'idle');
      pill.querySelector('.pnl-label').textContent = 'extra check';
      // re-init with a forced-tier flag (server may still honor passive signal).
      postInit({ _debug_force_tier: tier }).then(function (resp) {
        challengeToken = resp.challenge_token;
        currentTier = resp.tier;
        lastInitResp = resp;
        openPopoverWith(resp);
      });
    }

    // wait 2.5s after mount, unless an interaction happens earlier (then init immediately
    // — that's still a *passive* gesture, but signals presence).
    var bootstrapped = false;
    function maybeBootstrap() {
      if (bootstrapped) return; bootstrapped = true;
      bootstrap();
    }
    setTimeout(maybeBootstrap, Math.max(0, bootDelayMs));
    pill.addEventListener('mouseenter', maybeBootstrap, { once: true });
    pill.addEventListener('focus', maybeBootstrap, { once: true });

    // legacy click → if pop available, open it. if C0 already resolved, no-op.
    pill.addEventListener('click', function () {
      if (widget.token) return;
      maybeBootstrap();
      if (pop) return;

      // C1 second-chance path: after explicit click, re-init once with fresher
      // passive signals. if it downgrades to C0, auto-resolve without a question.
      if (currentTier === 'C1') {
        postInit({ _click_retry: 1 }).then(function (resp) {
          if (!resp || !resp.tier) return;
          challengeToken = resp.challenge_token;
          raterId = resp.rater_id;
          currentTier = resp.tier;
          lastInitResp = resp;
          if (currentTier === 'C0') {
            playC0Animation(function () {
              postResolveC0().then(function (rr) {
                if (rr && rr.success) fireSolved(rr.token, rr.trust, 'C0');
                else openPopoverWith(resp);
              }).catch(function () { openPopoverWith(resp); });
            });
          } else {
            openPopoverWith(resp);
          }
        }).catch(function () {
          if (lastInitResp) openPopoverWith(lastInitResp);
        });
        return;
      }

      // reopen existing C2/C3 challenge if user closed the popover manually.
      if (lastInitResp && currentTier && currentTier !== 'C0') openPopoverWith(lastInitResp);
    });

    // iframe message handler — for C1/C2/C3 popover resolutions
    function onMsg(ev) {
      if (!ev || !ev.data || typeof ev.data !== 'object') return;
      if (ev.origin !== ORIGIN) return;
      var d = ev.data;
      if (d.type === 'panel:solved' && d.token) {
        // important: multiple widgets can live on one page. only the widget
        // with an active popover should accept iframe solved messages.
        if (!pop) return;
        fireSolved(d.token, d.trust, currentTier || 'C1');
        // brief linger so the user sees the green flash, then close.
        setTimeout(function () {
          if (!pop) return;
          pop.setAttribute('data-state', 'closing');
          setTimeout(closePop, 220);
        }, 450);
      }
    }
    window.addEventListener('message', onMsg);

    widget.reset = function () {
      widget.token = null; widget.info = null; widget.tier_used = null;
      pill.setAttribute('data-state', 'idle');
      pill.removeAttribute('data-mode');
      pill.querySelector('.pnl-label').textContent = 'verify you\'re human';
      closePop();
      bootstrapped = false;
    };
    widget.destroy = function () {
      window.removeEventListener('message', onMsg);
      closePop();
      collector.destroy();
      try { el.removeChild(pill); } catch (_) {}
    };
    widget.open = function () { if (!bootstrapped) maybeBootstrap(); };
    widget.close = closePop;
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
    var widget = { __mode: 'inline', __v: 3, token: null, info: null, reset: function () {}, destroy: function () {}, open: function () {}, close: function () {} };
    function onMsg(ev) {
      if (!ev || !ev.data || typeof ev.data !== 'object') return;
      if (ev.origin !== ORIGIN) return;
      var d = ev.data;
      if (d.type === 'panel:solved' && d.token) {
        widget.token = d.token; widget.info = { trust: d.trust };
        try { if (typeof opts.onSolved === 'function') opts.onSolved({ token: d.token, trust: d.trust }); } catch (_) {}
        try { el.dispatchEvent(new CustomEvent('panel:solved', { detail: { token: d.token, trust: d.trust }, bubbles: true })); } catch (_) {}
      }
    }
    window.addEventListener('message', onMsg);
    widget.reset = function () { iframe.src = buildSrc({ site_key: siteKey, pool: pool }); widget.token = null; widget.info = null; };
    widget.destroy = function () { window.removeEventListener('message', onMsg); try { el.removeChild(iframe); } catch (_) {} };
    return widget;
  }

  // stable per-tab fingerprint id (random, NOT cross-site tracking — scoped to this widget mount).
  function getFpId() {
    try {
      var k = '__panel_fp_id';
      var v = sessionStorage.getItem(k);
      if (!v) { v = 'fp_' + Math.random().toString(36).slice(2, 14); sessionStorage.setItem(k, v); }
      return v;
    } catch (_) { return null; }
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
        force_tier: el.getAttribute('data-panel-force-tier') || null,
      });
    }
  }

  var Panel = { __v: 3, origin: ORIGIN, render: render, autoMount: autoMount };
  window.Panel = Panel;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }
})();
