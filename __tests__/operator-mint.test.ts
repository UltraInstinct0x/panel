// WS-U unit tests: operator-mint application + key mint + secret hashing.
// usage: tsx __tests__/operator-mint.test.ts

import * as fs from 'fs';
import * as path from 'path';

// isolate db file
const TMP_DB = path.join('/tmp', `panel-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.PANEL_DB_PATH = TMP_DB;

import {
  hashIngestSecret, verifyIngestSecret,
  createApplication, listApplications, getApplication,
  approveApplication, rejectApplication, mintSiteKey, rotateIngestSecret,
  getIngestSecretHash,
} from '../lib/operator-mint';

let passed = 0, failed = 0;
function eq(name: string, a: any, b: any) {
  if (a === b) { passed++; console.log('  ok ', name); }
  else { failed++; console.log('  FAIL', name, '— expected', JSON.stringify(b), 'got', JSON.stringify(a)); }
}
function truthy(name: string, v: any) {
  if (v) { passed++; console.log('  ok ', name); }
  else { failed++; console.log('  FAIL', name, '— expected truthy, got', JSON.stringify(v)); }
}

console.log('-- secret hashing --');
const secret = 'is_test_abc123_long_enough_for_real';
const h1 = hashIngestSecret(secret);
const h2 = hashIngestSecret(secret);
truthy('hash starts with scrypt$', h1.startsWith('scrypt$'));
truthy('hashes differ (random salt)', h1 !== h2);
eq('verify matches', verifyIngestSecret(secret, h1), true);
eq('verify wrong fails', verifyIngestSecret('wrong', h1), false);
eq('verify null hash fails', verifyIngestSecret(secret, null), false);
eq('verify garbage fails', verifyIngestSecret(secret, 'not-a-hash'), false);

console.log('-- application intake --');
const bad1 = createApplication({ name: '', email: 'a@b.co', intended_use: 'this is a long enough description for testing' });
eq('empty name rejected', (bad1 as any).reason, 'name_required');
const bad2 = createApplication({ name: 'x', email: 'not-an-email', intended_use: 'this is long enough for the test' });
eq('bad email rejected', (bad2 as any).reason, 'email_invalid');
const bad3 = createApplication({ name: 'x', email: 'a@b.co', intended_use: 'short' });
eq('short intended_use rejected', (bad3 as any).reason, 'intended_use_too_short');
const ok = createApplication({ name: 'goku', email: 'g@panel.dev', org: 'panel', intended_use: 'building a captcha replacement for agent traffic, expected ~10k/day' });
truthy('valid application accepted', (ok as any).ok);
truthy('returns app id', (ok as any).id?.startsWith('app_'));

console.log('-- rate limit --');
for (let i = 0; i < 3; i++) createApplication({ name: 'r', email: 'rate@test.co', intended_use: 'okay so this is the rate-limit test for repeats' });
const rl = createApplication({ name: 'r', email: 'rate@test.co', intended_use: 'okay so this is the rate-limit test for repeats' });
eq('4th from same email rate-limited', (rl as any).reason, 'rate_limited');

console.log('-- listing --');
const pending = listApplications('pending');
truthy('pending list has entries', pending.length >= 1);
truthy('intake found by id', getApplication((ok as any).id)?.email === 'g@panel.dev');

console.log('-- approval mints --');
const a = approveApplication({ application_id: (ok as any).id, admin_key: 'admin_test' }) as any;
truthy('approve succeeded', a.ok);
truthy('minted site_key has live prefix', a.minted.site_key.startsWith('pk_live_'));
truthy('minted ingest_secret has is_ prefix', a.minted.ingest_secret.startsWith('is_'));
eq('scrubber_required preserved', a.minted.scrubber_required, true);
const stored = getIngestSecretHash(a.minted.site_key);
truthy('hash stored', !!stored);
eq('stored hash verifies against raw secret', verifyIngestSecret(a.minted.ingest_secret, stored), true);

console.log('-- already-approved guard --');
const reAttempt = approveApplication({ application_id: (ok as any).id, admin_key: 'admin_test' });
eq('re-approve rejected', (reAttempt as any).reason, 'not_pending');

console.log('-- reject path --');
const rej = createApplication({ name: 'spam', email: 'spam@bots.io', intended_use: 'just a generic placeholder of sufficient length' }) as any;
const rejR = rejectApplication({ application_id: rej.id, admin_key: 'admin_test', reason: 'unclear use case' }) as any;
truthy('reject succeeded', rejR.ok);
const rejected = listApplications('rejected');
truthy('rejected list non-empty', rejected.length >= 1);

console.log('-- direct mint + rotate --');
const direct = mintSiteKey({ label: 'first-party / smoke', scrubber_required: false });
truthy('direct mint returns secret', !!direct.ingest_secret);
eq('scrubber false preserved on direct mint', direct.scrubber_required, false);
const rotated = rotateIngestSecret(direct.site_key) as any;
truthy('rotate returns new secret', rotated?.ingest_secret?.startsWith('is_'));
truthy('new secret differs', rotated.ingest_secret !== direct.ingest_secret);
eq('old secret no longer verifies', verifyIngestSecret(direct.ingest_secret, getIngestSecretHash(direct.site_key)), false);
eq('new secret verifies', verifyIngestSecret(rotated.ingest_secret, getIngestSecretHash(direct.site_key)), true);

try { fs.unlinkSync(TMP_DB); } catch {}

console.log('');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
