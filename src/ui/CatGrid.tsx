import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Category } from '../lib/types';
import { CatIcon, useCats } from './kit';

/** How many columns a CSS grid currently has (3 on narrow phones, 4 otherwise). */
function useGridCols(ref: React.RefObject<HTMLDivElement | null>) {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setCols(Math.max(1, getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return cols;
}

/**
 * Category tiles in a grid. When a tile is opened, `panel` slides open in a full-width row right
 * under that tile's row, so the subcategories appear next to what you tapped.
 */
export function CatGrid({
  items,
  open,
  pressed,
  onTile,
  panel,
  extra,
}: {
  items: Category[];
  open?: string;
  pressed: (c: Category) => boolean;
  onTile: (c: Category) => void;
  panel?: ReactNode;
  extra?: (c: Category) => ReactNode;
}) {
  const cx = useCats();
  const ref = useRef<HTMLDivElement | null>(null);
  const cols = useGridCols(ref);
  const idx = items.findIndex((c) => c.id === open);
  const after = idx < 0 ? -1 : Math.min(items.length - 1, Math.floor(idx / cols) * cols + cols - 1);
  // Point the panel's arrow at the opened tile.
  const arrow = idx < 0 ? 0 : ((idx % cols) + 0.5) / cols;
  return (
    <div className="cats" ref={ref}>
      {items.map((c, i) => {
        const has = cx.children(c.id).some((k) => !k.hidden);
        return (
          <Fragment key={c.id}>
            <button type="button" className="cat" aria-pressed={pressed(c)} aria-expanded={has ? open === c.id : undefined} onClick={() => onTile(c)}>
              <CatIcon id={c.id} />
              {c.name}
              {extra?.(c)}
              {has && <ChevronDown size={14} className="more" aria-hidden style={{ transform: open === c.id ? 'rotate(180deg)' : undefined }} />}
            </button>
            {i === after && panel && (
              <div className="cat-panel" key={`p-${open}`} style={{ ['--arrow' as string]: `${arrow * 100}%` }}>
                {panel}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
