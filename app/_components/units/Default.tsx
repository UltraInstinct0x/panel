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
  const codey = !!(unit.choices && unit.choices.some(c => /\n|def |function |\$|=>/.test(c.text)));
  return (
    <div className="u-def">
      {unit.diff && (
        <pre className="u-def-diff">{renderDiff(unit.diff)}</pre>
      )}

      {unit.choices && (
        <div className={codey ? 'u-def-cards u-def-cards--code' : 'u-def-cards'}>
          {unit.choices.map(c => (
            <button
              key={c.label}
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
