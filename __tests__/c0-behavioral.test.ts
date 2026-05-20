// WS-P C0 behavioral floor test: zero-mouse session → upgrade away from C0.
// pure-node integration. requires panel running.

'use strict';
const http = require('http');

const PANEL = process.env.PANEL_URL || 'http://127.0.0.1:3015';

function req(method, url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body == null ? null : Buffer.from(JSON.stringify(body));
    const r = http.request({
      method, host: u.hostname, port: u.port, path: u.pathname + u.search,
      headers: data ? { 'content-type': 'application/json', 'content-length': data.length } : {},
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
        catch { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  let passed = 0, failed = 0;
  const eq = (name, a, b) => {
    if (a === b) { passed++; console.log('  ok ', name); }
    else { failed++; console.log('  FAIL', name, '— expected', b, 'got', a); }
  };

  // 1. zero-signal → not C0
  const zero = await req('POST', PANEL + '/api/challenge/init', {
    site_key: 'pk_demo_a',
    fingerprint: { mouse_samples: [], scroll_samples: [], focus_events: 0, dwell_ms: 0 },
  });
  eq('zero-fp init 200', zero.status, 200);
  eq('zero-fp tier != C0', zero.body.tier !== 'C0', true);
  console.log('  zero-fp got tier:', zero.body.tier, 'trust:', zero.body.trust);

  // 2. clean fp → C0
  const mouse = Array.from({ length: 25 }, (_, i) => ({
    t: Date.now() + i * 50,
    x: 100 + Math.cos(i * 0.5) * 100,
    y: 100 + Math.sin(i * 0.5) * 100,
  }));
  const clean = await req('POST', PANEL + '/api/challenge/init', {
    site_key: 'pk_demo_a',
    fingerprint: {
      mouse_samples: mouse,
      scroll_samples: [{ t: 1, dy: 10 }, { t: 2, dy: 100 }, { t: 3, dy: 250 }],
      focus_events: 1, pointer_type: 'mouse', dwell_ms: 2700,
    },
  });
  eq('clean-fp 200', clean.status, 200);
  console.log('  clean-fp got tier:', clean.body.tier, 'trust:', clean.body.trust);
  eq('clean-fp = C0', clean.body.tier, 'C0');

  // 3. C0 resolve with no dwell → fail
  const bad = await req('POST', PANEL + '/api/challenge/resolve', {
    challenge_token: clean.body.challenge_token,
    fingerprint: { mouse_samples: [], focus_events: 0, dwell_ms: 100 },
  });
  eq('C0 resolve with low dwell fails', bad.body.success, false);

  // 4. fresh init + C0 resolve with proper dwell → success
  const clean2 = await req('POST', PANEL + '/api/challenge/init', {
    site_key: 'pk_demo_a',
    fingerprint: {
      mouse_samples: mouse, focus_events: 1, pointer_type: 'mouse', dwell_ms: 2700,
    },
  });
  const good = await req('POST', PANEL + '/api/challenge/resolve', {
    challenge_token: clean2.body.challenge_token,
    fingerprint: { mouse_samples: mouse, focus_events: 1, pointer_type: 'mouse', dwell_ms: 1500 },
  });
  eq('C0 resolve success', good.body.success, true);
  eq('tier_used=C0', good.body.tier_used, 'C0');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
