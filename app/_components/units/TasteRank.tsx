'use client';
import { RendererProps } from './types';

export default function TasteRank({ unit, onAnswer, disabled }: RendererProps) {
  const choices = unit.choices || [];
  // grid: 2-col if 2, 3-col if 3, stack if more
  const cols = Math.min(choices.length, 3);
  return (
    <div className="u-taste">
      <div className="u-taste-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {choices.map(c => (
          <button
            key={c.label}
            className="u-taste-card"
            disabled={disabled}
            onClick={() => onAnswer(c.label)}
            aria-label={`choice ${c.label}: ${c.text}`}
          >
            <span className="u-taste-tag">{c.label}</span>
            <span className="u-taste-text">{c.text}</span>
          </button>
        ))}
      </div>
      <button className="u-taste-tie" disabled={disabled} onClick={() => onAnswer('tie')}>
        no preference
      </button>
    </div>
  );
}
