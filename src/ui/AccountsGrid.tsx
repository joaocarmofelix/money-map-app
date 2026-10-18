import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Minus, SlidersHorizontal } from 'lucide-react';
import type { AccountView } from '../lib/stats';
import type { Settings } from '../lib/types';
import { getSettings, updateSettings } from '../lib/db';
import { fmt } from '../lib/text';
import { IconTile, toast } from './kit';

const HOLD_MS = 480;

const buzz = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
};

/**
 * The account tiles on the home screen. Press and hold one to edit, like a phone home screen:
 * the tiles wiggle now and then, the red minus hides one from here, and you can drag them into
 * the order you want. "Concluído" saves and leaves.
 */
export function AccountsGrid({ accounts, onManage }: { accounts: AccountView[]; settings: Settings; onManage: () => void }) {
  const [edit, setEdit] = useState(false);
  const [order, setOrder] = useState<string[]>(accounts.map((a) => a.key));
  const [drag, setDrag] = useState<string | null>(null);
  const hold = useRef<{ t: number; x: number; y: number } | null>(null);
  const grid = useRef<HTMLDivElement | null>(null);
  const tiles = useRef(new Map<string, HTMLDivElement>());
  // Where the finger is and where on the tile it grabbed, so the tile can follow it.
  const finger = useRef<{ x: number; y: number; gx: number; gy: number } | null>(null);
  const lastPos = useRef(new Map<string, { x: number; y: number }>());

  const follow = () => {
    const f = finger.current;
    const el = drag ? tiles.current.get(drag) : undefined;
    const g = grid.current?.getBoundingClientRect();
    if (!f || !el || !g) return;
    el.style.transform = `translate(${f.x - g.left - el.offsetLeft - f.gx}px, ${f.y - g.top - el.offsetTop - f.gy}px) scale(1.07) rotate(-2deg)`;
  };

  // When the order changes, the other tiles glide from their old place to the new one.
  useLayoutEffect(() => {
    for (const [key, el] of tiles.current) {
      const prev = lastPos.current.get(key);
      const now = { x: el.offsetLeft, y: el.offsetTop };
      if (prev && key !== drag && (prev.x !== now.x || prev.y !== now.y)) {
        el.animate([{ transform: `translate(${prev.x - now.x}px, ${prev.y - now.y}px)` }, { transform: 'translate(0, 0)' }], { duration: 220, easing: 'cubic-bezier(.2, .8, .2, 1)' });
      }
      lastPos.current.set(key, now);
    }
    follow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, drag]);

  const grab = (e: { clientX: number; clientY: number }, key: string) => {
    const r = tiles.current.get(key)?.getBoundingClientRect();
    finger.current = { x: e.clientX, y: e.clientY, gx: r ? e.clientX - r.left : 40, gy: r ? e.clientY - r.top : 40 };
  };

  // Drop: the tile settles into its slot.
  const settle = (key: string) => {
    const el = tiles.current.get(key);
    if (!el) return;
    const from = el.style.transform;
    el.style.transform = '';
    if (from) el.animate([{ transform: from }, { transform: 'translate(0, 0)' }], { duration: 200, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  };

  // Follow changes from elsewhere (new accounts, hidden ones) while not editing.
  const keys = accounts.map((a) => a.key).join('|');
  useEffect(() => {
    if (!edit) setOrder(accounts.map((a) => a.key));
    else setOrder((o) => [...o.filter((k) => accounts.some((a) => a.key === k)), ...accounts.map((a) => a.key).filter((k) => !o.includes(k))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  const byKey = new Map(accounts.map((a) => [a.key, a]));
  const list = order.map((k) => byKey.get(k)).filter((a): a is AccountView => !!a);

  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.t);
    hold.current = null;
  };

  const startHold = (e: React.PointerEvent, key: string) => {
    if (edit) return;
    const { clientX: x, clientY: y, pointerId } = e;
    const t = window.setTimeout(() => {
      hold.current = null;
      setEdit(true);
      buzz(18);
      // Keep holding and you can drag that tile straight away.
      grab({ clientX: x, clientY: y }, key);
      setDrag(key);
      try {
        grid.current?.setPointerCapture(pointerId);
      } catch {
        setDrag(null);
      }
    }, HOLD_MS);
    hold.current = { t, x, y };
  };

  const save = async (o: string[]) => {
    const fresh = await getSettings();
    // Keep accounts that are hidden right now in their old place at the end.
    const rest = (fresh.accountOrder ?? []).filter((k) => !o.includes(k));
    await updateSettings({ accountOrder: [...o, ...rest] });
  };

  const hide = async (a: AccountView) => {
    const fresh = await getSettings();
    await updateSettings({ hiddenAccounts: [...new Set([...fresh.hiddenAccounts, a.key])] });
    buzz(10);
    toast(`${a.name} escondida. Volta a mostrá-la em Mais › Contas.`);
  };

  const finish = async () => {
    setEdit(false);
    setDrag(null);
    await save(order);
  };

  // While dragging, the tile under the finger takes the dragged one's place.
  const onMove = (e: React.PointerEvent) => {
    if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 10) cancelHold();
    if (!drag) return;
    if (finger.current) {
      finger.current.x = e.clientX;
      finger.current.y = e.clientY;
      follow();
    }
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-acc]') as HTMLElement | null;
    const over = el?.dataset.acc;
    if (!over || over === drag) return;
    setOrder((o) => {
      const from = o.indexOf(drag);
      const to = o.indexOf(over);
      if (from < 0 || to < 0) return o;
      const n = [...o];
      n.splice(from, 1);
      n.splice(to, 0, drag);
      return n;
    });
    buzz(6);
  };

  const onUp = () => {
    cancelHold();
    if (drag) {
      settle(drag);
      finger.current = null;
      setDrag(null);
      save(order);
    }
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div
        ref={grid}
        className={`accounts${edit ? ' editing' : ''}`}
        role="list"
        aria-label="Contas"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {list.map((a, i) => (
          <div
            className={`acc${drag === a.key ? ' lifted' : ''}`}
            role="listitem"
            key={a.key}
            data-acc={a.key}
            ref={(el) => {
              if (el) tiles.current.set(a.key, el);
              else tiles.current.delete(a.key);
            }}
            style={{ animationDelay: `${(i % 5) * -0.37}s` }}
            onPointerDown={(e) => {
              if (!edit) return startHold(e, a.key);
              if ((e.target as HTMLElement).closest('.acc-minus')) return;
              grab(e, a.key);
              setDrag(a.key);
              grid.current?.setPointerCapture(e.pointerId);
            }}
          >
            {edit && (
              <button className="acc-minus" aria-label={`Esconder ${a.name} do início`} onClick={() => hide(a)}>
                <Minus size={14} strokeWidth={3.2} />
              </button>
            )}
            <IconTile icon={a.icon} color={a.color} size="sm" />
            <span className="nm">{a.name}</span>
            <div className="val num">{fmt(a.balance)}</div>
            <div className="when">{a.sub}</div>
          </div>
        ))}
        {!edit && (
          <button className="acc acc-edit" onClick={onManage}>
            <SlidersHorizontal size={18} />
            Contas
          </button>
        )}
      </div>
      {/* Under the grid, so entering edit mode doesn't move the tile under your finger. */}
      {edit && (
        <div className="acc-edit-bar">
          <span className="small muted">Arrasta para mudar a ordem · − para esconder</span>
          <button className="btn sm" onClick={finish}>
            Concluído
          </button>
        </div>
      )}
    </div>
  );
}
