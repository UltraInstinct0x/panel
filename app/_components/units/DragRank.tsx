'use client';
import { useRef, useMemo, useState } from 'react';
import { RendererProps } from './types';

type Props = RendererProps & {
  order: string[];
  setOrder: (o: string[]) => void;
};

export default function DragRank({ unit, onAnswer, disabled, order, setOrder }: Props) {
  const items = unit.items || [];
  const byLabel = useMemo(() => Object.fromEntries(items.map(i => [i.label, i.text])), [items]);
  const dragIdxRef = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrder(next);
  };

  const onKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); move(idx, -1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(idx, 1); }
  };

  return (
    <div className="u-drag">
      <div className="u-drag-hint">drag handle (⋮⋮) or use ↑/↓ buttons · arrow keys when focused</div>
      <ol className="u-drag-list" role="listbox" aria-label="rank items, top is best">
        {order.map((label, idx) => {
          const isDragging = dragging === idx;
          const isTarget = dragOver === idx && dragging !== idx;
          return (
            <li
              key={label}
              role="option"
              aria-selected={false}
              tabIndex={0}
              draggable={!disabled}
              onDragStart={() => { dragIdxRef.current = idx; setDragging(idx); }}
              onDragEnd={() => { setDragging(null); setDragOver(null); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(idx); }}
              onDragLeave={() => setDragOver(prev => prev === idx ? null : prev)}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIdxRef.current;
                dragIdxRef.current = null;
                setDragOver(null);
                setDragging(null);
                if (from == null || from === idx) return;
                const next = order.slice();
                const [moved] = next.splice(from, 1);
                next.splice(idx, 0, moved);
                setOrder(next);
              }}
              onKeyDown={(e) => onKey(e, idx)}
              className={
                'u-drag-row' +
                (isDragging ? ' u-drag-row--dragging' : '') +
                (isTarget ? ' u-drag-row--target' : '')
              }
              aria-grabbed={isDragging}
            >
              <span className="u-drag-handle" aria-hidden>⋮⋮</span>
              <span className="u-drag-rank">{idx + 1}</span>
              <span className="u-drag-label">{label}</span>
              <span className="u-drag-text">{byLabel[label]}</span>
              <span className="u-drag-chevs">
                <button
                  type="button"
                  className="u-chev"
                  aria-label={`move ${label} up`}
                  disabled={disabled || idx === 0}
                  onClick={() => move(idx, -1)}
                >▲</button>
                <button
                  type="button"
                  className="u-chev"
                  aria-label={`move ${label} down`}
                  disabled={disabled || idx === order.length - 1}
                  onClick={() => move(idx, 1)}
                >▼</button>
              </span>
            </li>
          );
        })}
      </ol>
      <button
        className="u-submit"
        disabled={disabled}
        onClick={() => onAnswer(order.join(','))}
      >
        submit ranking — {order.join(' › ')}
      </button>
    </div>
  );
}
