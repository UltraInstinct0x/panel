'use client';
import type { RendererUnit } from './types';

type Props = {
  unit: RendererUnit & {
    media_url?: string;
    media_type?: 'image' | 'video';
    poster_url?: string;
  };
  onAnswer: (choice: string) => void;
  disabled?: boolean;
};

// AI-vs-real binary on a single media item.
// Honeypot vector: panel mixes in known-real archive/public-source items;
// raters who consistently mark "ai" on real items get downweighted.
// Same shape as the legacy AiVsReal pair, but single-item to allow
// uneven seed pools (way more AI than archive in the wild).
export default function MediaOrigin({ unit, onAnswer, disabled }: Props) {
  const kind = unit.media_type || 'image';
  const url = unit.media_url || '';
  if (!url) {
    return <div className="u-mo-err">media missing</div>;
  }
  return (
    <div className="u-mo">
      <div className="u-mo-frame">
        {kind === 'video' ? (
          <video
            className="u-mo-media"
            src={url}
            controls
            muted
            playsInline
            preload="metadata"
            poster={unit.poster_url}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="u-mo-media" src={url} alt="" loading="lazy" />
        )}
      </div>
      <div className="u-mo-pills">
        <button className="u-pill u-pill--ai"   onClick={() => onAnswer('ai')}   disabled={disabled}>ai-generated</button>
        <button className="u-pill u-pill--real" onClick={() => onAnswer('real')} disabled={disabled}>real</button>
      </div>
    </div>
  );
}
