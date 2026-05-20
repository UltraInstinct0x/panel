'use client';
import { useMemo, useRef } from 'react';
import { RendererProps } from './types';

type Sel = { start: number; end: number } | null;

type Props = RendererProps & {
  selection: Sel;
  setSelection: (s: Sel) => void;
};

export default function SpanHighlight({ unit, onAnswer, disabled, selection, setSelection }: Props) {
  const passage = unit.passage || '';

  const tokens = useMemo(() => {
    const out: { text: string; start: number; end: number; isWord: boolean }[] = [];
    const re = /\S+|\s+/g;
    let m;
    while ((m = re.exec(passage)) !== null) {
      out.push({ text: m[0], start: m.index, end: m.index + m[0].length, isWord: /\S/.test(m[0]) });
    }
    return out;
  }, [passage]);

  const anchorRef = useRef<number | null>(null);
  // click count: 0 = idle, 1 = anchor set, 2 = selection complete (next click resets)
  const stateRef = useRef<0 | 1 | 2>(0);

  const onClick = (start: number, end: number) => {
    if (disabled) return;
    const s = stateRef.current;
    if (s === 0) {
      anchorRef.current = start;
      setSelection({ start, end });
      stateRef.current = 1;
    } else if (s === 1) {
      const a = anchorRef.current!;
      const lo = Math.min(a, start);
      const hi = Math.max(a + 0, end);
      setSelection({ start: lo, end: hi });
      stateRef.current = 2;
    } else {
      anchorRef.current = null;
      setSelection(null);
      stateRef.current = 0;
    }
  };

  const onKey = (e: React.KeyboardEvent, start: number, end: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(start, end);
    }
  };

  const complete = stateRef.current === 2 && selection != null;

  return (
    <div className="u-span">
      <div className="u-span-hint">click first word, then last word. third click resets.</div>
      <div className="u-span-passage">
        {tokens.map((t, i) => {
          const inSel = selection != null && t.start >= selection.start && t.end <= selection.end;
          if (!t.isWord) return <span key={i}>{t.text}</span>;
          return (
            <span
              key={i}
              role="button"
              tabIndex={disabled ? -1 : 0}
              className={'u-span-word' + (inSel ? ' u-span-word--sel' : '')}
              onClick={() => onClick(t.start, t.end)}
              onKeyDown={(e) => onKey(e, t.start, t.end)}
            >{t.text}</span>
          );
        })}
      </div>
      <button
        className="u-submit"
        disabled={disabled || !complete}
        onClick={() => selection && onAnswer(`${selection.start}-${selection.end}`)}
      >
        submit highlight{selection ? ` (chars ${selection.start}–${selection.end})` : ''}
      </button>
    </div>
  );
}
