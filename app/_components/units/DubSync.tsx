'use client';
import { RendererProps } from './types';

export default function DubSync({ unit, onAnswer, disabled }: RendererProps) {
  return (
    <div className="u-dub">
      <div className="u-dub-frame">
        {typeof unit.audio_offset_ms === 'number' && (
          <div className="u-dub-badge">
            offset {unit.audio_offset_ms >= 0 ? '+' : ''}{unit.audio_offset_ms}ms
          </div>
        )}
        {unit.video_url && (
          <video
            src={unit.video_url}
            controls
            playsInline
            width={480}
            preload="metadata"
            className="u-dub-video"
          />
        )}
      </div>
      <div className="u-pill-row">
        <button className="u-pill u-pill-ok" disabled={disabled} onClick={() => onAnswer('yes')}>
          in sync
        </button>
        <button className="u-pill u-pill-bad" disabled={disabled} onClick={() => onAnswer('no')}>
          out of sync
        </button>
        <button className="u-pill u-pill-ghost" disabled={disabled} onClick={() => onAnswer('unsure')}>
          unsure
        </button>
      </div>
    </div>
  );
}
