'use client';
import { RendererProps } from './types';

export default function AiVsReal({ unit, onAnswer, disabled }: RendererProps) {
  const hasImage = !!unit.image_url;
  // strip surrounding quotes if present
  const text = unit.prompt_context.replace(/^[^"“]*["“]/, '').replace(/["”][^"”]*$/, '');
  const body = /["“”]/.test(unit.prompt_context) ? text : unit.prompt_context;

  return (
    <div className="u-aivr">
      {hasImage ? (
        <div className="u-aivr-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={unit.image_url} alt="solve: is this image AI-generated or real" width={320} height={320} />
        </div>
      ) : (
        <blockquote className="u-aivr-quote">
          <span className="u-aivr-mark">“</span>
          <span className="u-aivr-text">{body}</span>
          <span className="u-aivr-mark u-aivr-mark-end">”</span>
        </blockquote>
      )}

      <div className="u-pill-row">
        <button className="u-pill" disabled={disabled} onClick={() => onAnswer('no')}>
          human
        </button>
        <button className="u-pill" disabled={disabled} onClick={() => onAnswer('yes')}>
          ai
        </button>
        <button className="u-pill u-pill-ghost" disabled={disabled} onClick={() => onAnswer('unsure')}>
          unsure
        </button>
      </div>
    </div>
  );
}
