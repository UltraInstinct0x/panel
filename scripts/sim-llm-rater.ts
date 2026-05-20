// WS-O: sim-LLM-rater. acts as a frontier-LLM-backed rater that always picks
// the surface-obvious answer. asserts trust < 0.3 within 50 ratings, repeatable.
//
// usage:
//   PANEL_BASE=http://127.0.0.1:3015 PANEL_KEY=pk_demo_a OPENROUTER_API_KEY=... \
//     pnpm tsx scripts/sim-llm-rater.ts [--n 50] [--no-llm]
//
// CI / offline: pass --no-llm to use the deterministic heuristic stub.

interface Unit {
  id: string;
  type: string;
  question?: string;
  prompt_context?: string;
  passage?: string;
  choices?: Array<{ label: string; text: string }>;
  items?: Array<{ label: string; text: string }>;
  binary?: { yes: string; no: string };
}

const BASE = process.env.PANEL_BASE || 'http://127.0.0.1:3015';
const KEY = process.env.PANEL_KEY || 'pk_demo_a';
const OR_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

function arg(flag: string, def?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? '') : def;
}
const N = parseInt(arg('--n', '50') ?? '50', 10);
const USE_LLM = !process.argv.includes('--no-llm') && !!OR_KEY;
const RATER_ID = `sim_llm_${Date.now().toString(36)}`;

async function getUnit(): Promise<Unit> {
  const r = await fetch(`${BASE}/api/units/next?rater_id=${RATER_ID}&pool=public`, {
    headers: { 'x-panel-site-key': KEY },
  });
  if (!r.ok) throw new Error(`units/next ${r.status}: ${await r.text()}`);
  return r.json();
}

async function submit(unit_id: string, choice: string): Promise<any> {
  // satisfy ENGAGEMENT_MIN_MS = 2500
  const latency_ms = 2700 + Math.floor(Math.random() * 800);
  const body = { unit_id, rater_id: RATER_ID, choice, latency_ms, confidence: 0.6, behavioral: { dwell_ms: latency_ms } };
  const r = await fetch(`${BASE}/api/judgments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-panel-site-key': KEY },
    body: JSON.stringify(body),
  });
  return r.json();
}

function heuristicAnswer(u: Unit): string {
  // mimics the "obvious surface LLM" guess deterministically — exactly the
  // failure mode honeypots are designed to catch.
  const txt = (u.passage || u.prompt_context || u.question || '').toLowerCase();
  if (u.type === 'sarcasm_detect') {
    // surface tone: "honestly", "love the", "triumph" → flag as sarcastic if any
    // negative cue, sincere if any positive cue. flips honeypot intent.
    const sarcCue = /\b(honestly|literally|sure|love the|appreciate|triumph)\b/.test(txt);
    return sarcCue ? 'sarcastic' : 'sincere';
  }
  if (u.type === 'ai_vs_real') {
    // short staccato / clean prose → ai. anything florid → human.
    const tells = /(handcrafted|perfect addition|delightful|thoughtfully|elevate)/.test(txt);
    return tells ? 'ai' : (txt.length < 120 ? 'ai' : 'human');
  }
  if (u.type === 'taste_rank' && u.items) {
    // "best looking / most polished" first → exactly the cliché wrong choice.
    const labels = u.items.map(i => i.label);
    return labels.join(',');
  }
  if (u.type === 'step_validity') {
    // syntactically-clean tool calls → 'valid'. classic LLM blind spot.
    return 'valid';
  }
  if (u.type === 'skill_diff') {
    // "simplification" / shorter diff → 'improvement'.
    return 'improvement';
  }
  if (u.type === 'hallucination_flag') {
    // any keyword overlap source↔claim → 'supported'.
    return 'supported';
  }
  // fallback: first choice
  if (u.choices?.length) return u.choices[0].label;
  if (u.binary) return u.binary.yes;
  return 'a';
}

async function llmAnswer(u: Unit): Promise<string> {
  const prompt = [
    `Unit type: ${u.type}`,
    u.prompt_context ? `Context: ${u.prompt_context}` : '',
    u.question ? `Question: ${u.question}` : '',
    u.passage ? `Passage: ${u.passage}` : '',
    u.choices ? `Choices: ${u.choices.map(c => `[${c.label}] ${c.text}`).join(' | ')}` : '',
    u.items ? `Rank these items best→worst, reply with comma-separated labels only (e.g. "A,B,C"): ${u.items.map(i => `[${i.label}] ${i.text}`).join(' | ')}` : '',
    u.binary ? `Reply yes or no.` : '',
    'Reply with ONLY the answer label/string, nothing else.',
  ].filter(Boolean).join('\n');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${OR_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 32,
      temperature: 0,
    }),
  });
  const j: any = await r.json();
  const out = (j?.choices?.[0]?.message?.content || '').trim();
  return out;
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[sim-llm-rater] rater=${RATER_ID} base=${BASE} n=${N} llm=${USE_LLM ? MODEL : 'heuristic'}`);
  let lastTrust = 0.5;
  let honeypotsSeen = 0;
  let honeypotFails = 0;
  for (let i = 0; i < N; i++) {
    let u: Unit;
    try { u = await getUnit(); }
    catch (e) { console.error('getUnit fail', e); break; }
    const choice = USE_LLM ? await llmAnswer(u).catch(() => heuristicAnswer(u)) : heuristicAnswer(u);
    const res = await submit(u.id, choice);
    if (res?._demo_honeypot_failed) honeypotFails++;
    if (typeof res?.trust === 'number') lastTrust = res.trust;
    if (u.id.startsWith('hp_')) honeypotsSeen++;
    // eslint-disable-next-line no-console
    console.log(`#${i + 1} type=${u.type} hp=${u.id.startsWith('hp_') ? 'Y' : 'n'} choice=${JSON.stringify(choice).slice(0, 40)} trust=${lastTrust.toFixed(3)} ${res?._demo_honeypot_failed ? 'HP-FAIL' : ''}`);
  }
  const ok = lastTrust < 0.3;
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    rater: RATER_ID,
    n: N,
    final_trust: lastTrust,
    honeypots_seen: honeypotsSeen,
    honeypot_fails: honeypotFails,
    assertion_trust_lt_0_3: ok,
  }, null, 2));
  if (!ok) {
    console.error(`ASSERTION FAILED: trust ${lastTrust} not < 0.3 within ${N} ratings`);
    process.exit(2);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
