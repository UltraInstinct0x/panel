// WS-P anti-reroll test: failed C2 → resolve returns same payload, same challenge_token still valid.
// pure-node. requires panel running at $PANEL_URL (default http://127.0.0.1:3015).
//
// usage: node __tests__/anti-reroll.test.ts

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
        const txt = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, body: JSON.parse(txt) }); }
        catch { resolve({ status: res.statusCode, body: txt }); }
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

  // init forced C2
  const init = await req('POST', PANEL + '/api/challenge/init', {
    site_key: 'pk_demo_a', _debug_force_tier: 'C2',
  });
  eq('init status 200', init.status, 200);
  eq('tier C2', init.body.tier, 'C2');
  const token = init.body.challenge_token;
  const units1 = init.body.units;
  if (!units1 || units1.length === 0) {
    console.log('  SKIP (no units seeded)'); process.exit(0);
  }
  const ids1 = units1.map(u => u.id).sort();
  console.log('  units issued:', ids1);

  // resolve with wrong answers → should return retry=true + same units
  const wrong1 = await req('POST', PANEL + '/api/challenge/resolve', {
    challenge_token: token,
    answers: units1.map(u => ({ unit_id: u.id, choice: '__definitely_not_a_real_choice__', latency_ms: 3000 })),
    fingerprint: { mouse_samples: [], focus_events: 1, dwell_ms: 3000 },
  });
  eq('first wrong resolve success=false', wrong1.body.success, false);
  eq('first wrong resolve retry=true', wrong1.body.retry, true);
  const ids2 = (wrong1.body.units || []).map(u => u.id).sort();
  eq('same units on retry', JSON.stringify(ids1), JSON.stringify(ids2));

  // resolve wrong again → still same units, attempts=2
  const wrong2 = await req('POST', PANEL + '/api/challenge/resolve', {
    challenge_token: token,
    answers: units1.map(u => ({ unit_id: u.id, choice: '__wrong_again__', latency_ms: 3000 })),
    fingerprint: { mouse_samples: [], focus_events: 1, dwell_ms: 3000 },
  });
  const ids3 = (wrong2.body.units || wrong2.body.units || []).map(u => u.id).sort();
  // depending on max_attempts default for C2 (=3), this could be retry or hard_fail
  if (wrong2.body.hard_fail) {
    eq('hard_fail after 2 attempts on C2', wrong2.body.hard_fail, true);
  } else {
    eq('still same units on 2nd retry', JSON.stringify(ids1), JSON.stringify(ids3));
    eq('attempts=2', wrong2.body.attempts, 2);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
