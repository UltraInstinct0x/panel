'use client';
import type { RendererUnit } from './types';

type Props = {
  unit: RendererUnit & {
    media_url?: string;
    media_type?: 'image' | 'video';
    poster_url?: string;
    duration_hint_s?: number;
  };
  onAnswer: (choice: string) => void;
  disabled?: boolean;
};

// AI-generated media quality rating.
// Mirrors ProcessOutputRating's 4-pill schema (good/meh/broken/spam)
// but the frame is visual instead of monospace prose.
export default function MediaQuality({ unit, onAnswer, disabled }: Props) {
  const kind = unit.media_type || 'image';
  const url = unit.media_url || '';
  if (!url) {
    return <div className="u-mq-err">media missing</div>;
  }
  return (
    <div className="u-mq">
      <div className="u-mq-frame">
        {kind === 'video' ? (
          <video
            className="u-mq-media"
            src={url}
            controls
            muted
            playsInline
            preload="metadata"
            poster={unit.poster_url}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="u-mq-media" src={url} alt="" loading="lazy" />
        )}
      </div>
      <div className="u-mq-pills">
        <button className="u-pill u-pill--ok"   onClick={() => onAnswer('good')}   disabled={disabled}>good</button>
        <button className="u-pill u-pill--mid"  onClick={() => onAnswer('meh')}    disabled={disabled}>meh</button>
        <button className="u-pill u-pill--bad"  onClick={() => onAnswer('broken')} disabled={disabled}>broken</button>
        <button className="u-pill u-pill--spam" onClick={() => onAnswer('spam')}   disabled={disabled}>spam</button>
      </div>
    </div>
  );
}
