import { ok, strictEqual } from 'node:assert';
import { NextRequest } from 'next/server';
import { issue } from '../lib/attestation';
import { createSession, __resetSessions } from '../lib/tier-session';
import { recordChallengeIssued } from '../lib/operator-stats';

async function run() {
  __resetSessions();
  const route = await import('../app/api/challenge/resolve/route');
  const jti = 'ch_edge_contract_test';
  const token = issue({
    jti,
    uid: `challenge:${jti}`,
    rid: 'r_test',
    pool: 'public',
    site_key: 'pk_demo_a',
    rater: { trust: 0.7, behavioral_score: 0.7 },
    judgment_summary: { agreed_with_pool: null, latency_ms: 0, honeypot_failed: false },
    scrubber_attestation: { service: 'na', rules_version: 'na', redactions: [], passed: true },
    exp_ms: 5 * 60 * 1000,
  });
  createSession({ id: jti, site_key: 'pk_demo_a', tier: 'C0', unit_ids: [] });
  recordChallengeIssued({ jti, site_key: 'pk_demo_a', tier: 'C0', pool: 'public', trust: 0.8, risk: 0.1 });

  const req = new NextRequest('http://localhost/api/challenge/resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      challenge_token: token,
      fingerprint: {
        mouse_samples: [
          { t: 1, x: 1, y: 1 },
          { t: 100, x: 30, y: 20 },
          { t: 180, x: 45, y: 12 },
          { t: 260, x: 10, y: 40 },
        ],
        scroll_samples: [{ t: 1, dy: 1 }, { t: 2, dy: 40 }],
        focus_events: 1,
        pointer_type: 'mouse',
        dwell_ms: 1200,
      },
      edge_model: {
        runtime: 'rules_only',
        model_error: true,
        reason_codes: ['runtime_unsupported'],
      },
    }),
  });

  const res = await route.POST(req);
  strictEqual(res.status, 200);
  const json = await res.json();
  strictEqual(json.success, true);
  strictEqual(json.verdict?.verdict, 'human');
  strictEqual(json.verdict?.model?.runtime, 'rules_only');
  ok(Array.isArray(json.verdict?.reason_codes), 'verdict.reason_codes is array');
  ok(json.verdict.reason_codes.includes('edge_model_contract_fallback'), 'fallback reason code exposed');
}

run()
  .then(() => console.log('challenge-resolve-edge-contract.test: ok'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
