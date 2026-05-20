'use client';
import { RendererProps } from './types';

function renderDiff(diff: string) {
  return diff.split('\n').map((line, i) => {
    const cls = line.startsWith('+') ? 'diff-add' : line.startsWith('-') ? 'diff-del' : 'diff-ctx';
    return <div key={i} className={cls}>{line || '\u00a0'}</div>;
  });
}

// fallback renderer for: pairwise_trace, step_validity, skill_diff, hallucination_flag.
// kept reasonably polished — code blocks render as monospace cards, diff inline,
// binary as two big pills, choices as ranked cards.
export default function Default({ unit, onAnswer, disabled }: RendererProps) {
  const norm = (s: string) => String(s || '').trim().toLowerCase().replace(/^[-✓✗\s]+/, '');
  const uniqueChoices = (unit.choices || []).filter((c, i, arr) => {
    const t = norm(c.text);
    return !!t && arr.findIndex(x => norm(x.text) === t) === i;
  });
  const codey = !!(uniqueChoices.length && uniqueChoices.some(c => /\n|def |function |\$|=>/.test(c.text)));
  const binaryLikeChoices = uniqueChoices.length > 0 && uniqueChoices.length <= 2;
  const showChoices = uniqueChoices.length > 0 && !(unit.binary && binaryLikeChoices);
  const detail = unit.passage || unit.prompt_context || (
    unit.tool ? `tool: ${unit.tool}\nargs: ${JSON.stringify(unit.args ?? null)}\nresult: ${JSON.stringify(unit.result ?? null)}` : ''
  );

  return (
    <div className="u-def">
      {unit.diff && (
        <pre className="u-def-diff">{renderDiff(unit.diff)}</pre>
      )}

      {detail && (
        <pre className="u-por-text" style={{ marginBottom: 12, maxHeight: 220, overflow: 'auto' }}>{String(detail)}</pre>
      )}

      {showChoices && (
        <div className={codey ? 'u-def-cards u-def-cards--code' : 'u-def-cards'}>
          {uniqueChoices.map((c, idx) => (
            <button
              key={`${c.label}-${idx}`}
              className="u-def-card"
              disabled={disabled}
              onClick={() => onAnswer(c.label)}
            >
              <span className="u-taste-tag">{c.label}</span>
              {codey ? <pre className="u-def-code">{c.text}</pre> : <span className="u-def-text">{c.text}</span>}
            </button>
          ))}
        </div>
      )}

      {unit.binary && (
        <div className="u-pill-row u-pill-row--binary">
          <button className="u-pill u-pill-ok" disabled={disabled} onClick={() => onAnswer('yes')}>
            ✓ {unit.binary.yes}
          </button>
          <button className="u-pill u-pill-bad" disabled={disabled} onClick={() => onAnswer('no')}>
            ✗ {unit.binary.no}
          </button>
        </div>
      )}
    </div>
  );
}
