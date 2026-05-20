// WS-O: admin form to add a new honeypot. POSTs to /api/admin/honeypots.
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TYPES = ['sarcasm_detect', 'ai_vs_real', 'taste_rank', 'step_validity', 'skill_diff', 'hallucination_flag'] as const;

export default function NewHoneypotPage() {
  const r = useRouter();
  const [unit_type, setType] = useState<typeof TYPES[number]>('sarcasm_detect');
  const [payload, setPayload] = useState<string>('{\n  "question": "...",\n  "prompt_context": "...",\n  "choices": [{"label":"a","text":"a"}, {"label":"b","text":"b"}],\n  "est_seconds": 25\n}');
  const [decoy, setDecoy] = useState('');
  const [truth, setTruth] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      let parsed: unknown;
      try { parsed = JSON.parse(payload); } catch { throw new Error('payload is not valid JSON'); }
      const res = await fetch('/api/admin/honeypots', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ unit_type, payload: parsed, decoy_answer: decoy, true_answer: truth, expert_notes: notes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `http ${res.status}`);
      }
      r.push('/admin/honeypots');
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'ui-monospace, monospace', maxWidth: 800 }}>
      <h1 style={{ fontSize: 20 }}>new honeypot</h1>
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        decoy = the &quot;obvious LLM guess&quot; that is wrong by design. true = what a careful human picks. expert_notes = why decoy fools an LLM.
      </p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, fontSize: 13 }}>
        <label>type
          <select value={unit_type} onChange={e => setType(e.target.value as typeof TYPES[number])} style={{ marginLeft: 8 }}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>payload (JSON, includes question/choices/etc.)
          <textarea value={payload} onChange={e => setPayload(e.target.value)} rows={10} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} />
        </label>
        <label>decoy_answer (the wrong-by-design LLM answer — must equal one of the choice labels / option strings)
          <input value={decoy} onChange={e => setDecoy(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>true_answer (correct answer)
          <input value={truth} onChange={e => setTruth(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>expert_notes (why decoy fools an LLM)
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} style={{ width: '100%' }} />
        </label>
        {err && <div style={{ color: '#a00' }}>{err}</div>}
        <button disabled={busy} type="submit" style={{ padding: '8px 14px', width: 'fit-content' }}>
          {busy ? 'saving…' : 'create honeypot'}
        </button>
      </form>
    </main>
  );
}
