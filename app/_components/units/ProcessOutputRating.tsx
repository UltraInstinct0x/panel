'use client';
import { RendererProps } from './types';

// process_output_rating: agent process output (text — code, plan, tool call result, message).
// rate quality: good / meh / broken / spam. emitted on session.idle with tool calls.
// reuses ImageRating layout/buttons but renders text passage instead of image.
// expects unit.passage (preferred) or falls back to unit.prompt_context.
export default function ProcessOutputRating({ unit, onAnswer, disabled }: RendererProps) {
  const text = unit.passage || unit.prompt_context || '';
  return (
    <div className="u-airating">
      <div className="u-por-frame">
        <pre className="u-por-text">{text || '(empty output)'}</pre>
      </div>
      <div className="u-airating-meta">
        <span className="u-airating-tag">{unit.source_agent || 'unknown agent'}</span>
      </div>
      <div className="u-airating-grid">
        <button className="u-airating-btn u-airating-good" disabled={disabled} onClick={() => onAnswer('good')}>
          <span className="u-airating-lbl">good</span>
          <span className="u-airating-sub">on-task, useful</span>
        </button>
        <button className="u-airating-btn u-airating-meh" disabled={disabled} onClick={() => onAnswer('meh')}>
          <span className="u-airating-lbl">meh</span>
          <span className="u-airating-sub">partial, hedging</span>
        </button>
        <button className="u-airating-btn u-airating-broken" disabled={disabled} onClick={() => onAnswer('broken')}>
          <span className="u-airating-lbl">broken</span>
          <span className="u-airating-sub">wrong, off-task</span>
        </button>
        <button className="u-airating-btn u-airating-spam" disabled={disabled} onClick={() => onAnswer('spam')}>
          <span className="u-airating-lbl">spam</span>
          <span className="u-airating-sub">junk / unsafe</span>
        </button>
      </div>
    </div>
  );
}
