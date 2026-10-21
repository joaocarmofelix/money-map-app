import { useRef } from 'react';
import { flushSync } from 'react-dom';

const buzz = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
};

interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SETTLE_MS = 220;

/**
 * Drag-to-reorder for items of the same size laid out in a grid or a column.
 *
 * State lives in data- attributes, which React leaves alone when it re-renders.
 *
 * Nothing re-renders while you drag. Item slots are measured once when the drag starts; the
 * dragged item follows the finger and the others glide to their new slot with a CSS transform.
 * The new order is handed to React only after the drop has settled, in the same frame the
 * transforms are cleared, so the picture never jumps.
 *
 * A swap needs the finger well inside another slot (not just on its edge), which stops two
 * items flipping back and forth at the boundary.
 */
export function useSortable<K extends string>({
  order,
  onCommit,
  axis = 'both',
}: {
  /** The current order, as rendered. */
  order: K[];
  /** Called once, after the drop, with the new order (only when it changed). */
  onCommit: (next: K[]) => void;
  axis?: 'both' | 'y';
}) {
  const container = useRef<HTMLElement | null>(null);
  const items = useRef(new Map<K, HTMLElement>());
  const st = useRef<{
    key: K;
    start: K[];
    live: K[];
    slots: Slot[];
    grabX: number;
    grabY: number;
    x: number;
    y: number;
    frame: number;
  } | null>(null);

  const place = (el: HTMLElement, dx: number, dy: number) => {
    el.style.transform = dx || dy ? `translate3d(${dx}px, ${dy}px, 0)` : '';
  };

  const paint = () => {
    const s = st.current;
    if (!s) return;
    s.frame = 0;
    const el = items.current.get(s.key);
    const home = s.slots[s.start.indexOf(s.key)];
    const c = container.current?.getBoundingClientRect();
    if (!el || !home || !c) return;
    const dx = axis === 'y' ? 0 : s.x - s.grabX - c.left - home.x;
    const dy = s.y - s.grabY - c.top - home.y;
    place(el, dx, dy);

    // Which slot is the finger in? Only the middle of a slot counts.
    const fx = s.x - c.left;
    const fy = s.y - c.top;
    const target = s.slots.findIndex((r) => {
      const mx = r.w * 0.18;
      const my = r.h * 0.18;
      const inY = fy > r.y + my && fy < r.y + r.h - my;
      return axis === 'y' ? inY : inY && fx > r.x + mx && fx < r.x + r.w - mx;
    });
    const at = s.live.indexOf(s.key);
    if (target < 0 || target === at) return;
    const next = s.live.filter((k) => k !== s.key);
    next.splice(target, 0, s.key);
    s.live = next;
    // Everyone else glides to their new slot.
    next.forEach((k, i) => {
      if (k === s.key) return;
      const node = items.current.get(k);
      const from = s.slots[s.start.indexOf(k)];
      const to = s.slots[i];
      if (node && from && to) place(node, to.x - from.x, to.y - from.y);
    });
    buzz(6);
  };

  /** Start dragging `key` from this pointer position. */
  const begin = (e: { clientX: number; clientY: number; pointerId: number }, key: K) => {
    const box = container.current;
    const el = items.current.get(key);
    if (!box || !el || st.current) return;
    const c = box.getBoundingClientRect();
    const slots = order.map((k) => {
      const r = items.current.get(k)!.getBoundingClientRect();
      return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height };
    });
    const r = el.getBoundingClientRect();
    st.current = { key, start: [...order], live: [...order], slots, grabX: e.clientX - r.left, grabY: e.clientY - r.top, x: e.clientX, y: e.clientY, frame: 0 };
    box.dataset.sorting = '';
    el.dataset.lifted = '';
    try {
      box.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer is already gone */
    }
  };

  const move = (e: { clientX: number; clientY: number }) => {
    const s = st.current;
    if (!s) return;
    s.x = e.clientX;
    s.y = e.clientY;
    if (!s.frame) s.frame = requestAnimationFrame(paint);
  };

  /** Drop: the item glides into its slot, then the new order is committed. */
  const end = () => {
    const s = st.current;
    if (!s) return;
    if (s.frame) cancelAnimationFrame(s.frame);
    const box = container.current;
    const el = items.current.get(s.key);
    if (el) {
      delete el.dataset.lifted;
      const from = s.slots[s.start.indexOf(s.key)];
      const to = s.slots[s.live.indexOf(s.key)];
      if (from && to) place(el, to.x - from.x, to.y - from.y);
    }
    const changed = s.live.some((k, i) => k !== s.start[i]);
    window.setTimeout(() => {
      // Commit and clear the transforms in the same frame, with transitions off.
      if (box) box.dataset.instant = '';
      if (changed) flushSync(() => onCommit(s.live));
      for (const node of items.current.values()) place(node, 0, 0);
      void box?.offsetHeight;
      if (box) {
        delete box.dataset.instant;
        delete box.dataset.sorting;
      }
      st.current = null;
    }, SETTLE_MS);
  };

  const ref = (key: K) => (el: HTMLElement | null) => {
    if (el) items.current.set(key, el);
    else items.current.delete(key);
  };

  const containerRef = (el: HTMLElement | null) => {
    container.current = el;
  };

  return {
    containerRef,
    ref,
    begin,
    /** Pass to the container's onPointerMove / onPointerUp / onPointerCancel. */
    move,
    end,
    active: () => !!st.current,
  };
}
