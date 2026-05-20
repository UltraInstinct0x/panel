'use client';
import { RendererProps } from './types';

// prompt_rewrite_pair: two prose alternatives (A/B), pick the better rewrite.
// emitted when agents detect a user steering correction ("actually,", "no,", "instead,")
// and we want to learn which phrasing wins on the next turn.
// expects unit.choices = [{ label: 'A', text: '...' }, { label: 'B', text: '...' }]
export default function PromptRewritePair({ unit, onAnswer, disabled }: RendererProps) {
  const choices = unit.choices && unit.choices.length >= 2 ? unit.choices.slice(0, 2) : null;
  if (!choices) {
    return (
      <div className="u-prp u-prp-err">
        <span>missing rewrite pair</span>
      </div>
    );
  }
  const [a, b] = choices;
  return (
    <div className="u-prp">
      <div className="u-prp-grid">
        <button
          className="u-prp-card"
          disabled={disabled}
          onClick={() => onAnswer(a.label)}
          aria-label={`pick option ${a.label}`}
        >
          <span className="u-prp-tag">{a.label}</span>
          <span className="u-prp-text">{a.text}</span>
        </button>
        <button
          className="u-prp-card"
          disabled={disabled}
          onClick={() => onAnswer(b.label)}
          aria-label={`pick option ${b.label}`}
        >
          <span className="u-prp-tag">{b.label}</span>
          <span className="u-prp-text">{b.text}</span>
        </button>
      </div>
      <button
        className="u-prp-tie"
        disabled={disabled}
        onClick={() => onAnswer('tie')}
      >
        about the same
      </button>
    </div>
  );
}
