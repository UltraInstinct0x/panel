import { ok, strictEqual } from 'node:assert';
import { buildStructuredVerdict, ingestEdgeModelPayload } from '../lib/edge-model-contract';

const fallback = ingestEdgeModelPayload({ runtime: 'rules_only', model_error: true, reason_codes: ['runtime_unsupported'] });
ok(fallback.fallback === true, 'rules_only + model_error triggers fallback');
ok(fallback.reason_codes.includes('edge_model_contract_fallback'), 'fallback reason code appended');

const passVerdict = buildStructuredVerdict({ pass: true, trust: 0.8, edge: fallback });
strictEqual(passVerdict.verdict, 'human');
strictEqual(passVerdict.model.runtime, 'rules_only');
ok(passVerdict.reason_codes.includes('edge_model_contract_fallback'));

const failVerdict = buildStructuredVerdict({ pass: false, trust: 0.1, resolveReason: 'c0_trust_floor', edge: ingestEdgeModelPayload({}) });
strictEqual(failVerdict.verdict, 'bot');
strictEqual(failVerdict.trust_tier, 'blocked');
ok(failVerdict.reason_codes.includes('c0_trust_floor'));

const nullScore = ingestEdgeModelPayload({ local_score: null as unknown as number });
strictEqual(nullScore.local_score, null, 'null score must remain absent, not coerced to 0');

const probSanitize = ingestEdgeModelPayload({
  local_class_probs: { human: '0.9' as unknown as number, bot: null as unknown as number, weird: 'x' as unknown as number }
});
strictEqual(probSanitize.local_class_probs.human, 0.9);
strictEqual('bot' in probSanitize.local_class_probs, false);
strictEqual('weird' in probSanitize.local_class_probs, false);

console.log('edge-model-contract.test: ok');
