'use client';
import { RendererProps } from './types';

// ai_output_rating: shown an image (an AI-generated output) and asked to rate it.
// 4 choices: good / meh / broken / spam. No gold — peer-aggregated score.
// Used by operators like img.goku.codes where every Modal op output becomes a rateable unit.
export default function ImageRating({ unit, onAnswer, disabled }: RendererProps) {
  return (
    <div className="u-airating">
      {unit.image_url && (
        <div className="u-airating-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={unit.image_url}
            alt="ai output to rate"
            className="u-airating-img"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      <div className="u-airating-meta">
        <span className="u-airating-tag">{unit.source_agent || 'unknown'}</span>
        {unit.prompt_context && <span className="u-airating-ctx">{unit.prompt_context}</span>}
      </div>
      <div className="u-airating-grid">
        <button className="u-airating-btn u-airating-good" disabled={disabled} onClick={() => onAnswer('good')}>
          <span className="u-airating-lbl">good</span>
          <span className="u-airating-sub">clean output, ship it</span>
        </button>
        <button className="u-airating-btn u-airating-meh" disabled={disabled} onClick={() => onAnswer('meh')}>
          <span className="u-airating-lbl">meh</span>
          <span className="u-airating-sub">usable but flawed</span>
        </button>
        <button className="u-airating-btn u-airating-broken" disabled={disabled} onClick={() => onAnswer('broken')}>
          <span className="u-airating-lbl">broken</span>
          <span className="u-airating-sub">artifacts, mangled</span>
        </button>
        <button className="u-airating-btn u-airating-spam" disabled={disabled} onClick={() => onAnswer('spam')}>
          <span className="u-airating-lbl">spam</span>
          <span className="u-airating-sub">nsfw / abusive / off</span>
        </button>
      </div>
    </div>
  );
}
