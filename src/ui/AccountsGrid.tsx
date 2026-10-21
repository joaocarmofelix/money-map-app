import { useEffect, useRef, useState } from 'react';
import { useSortable } from './useSortable';
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
 * the order you want (see useSortable). "Concluído" saves and leaves.
 */
export function AccountsGrid({ accounts, onManage }: { accounts: AccountView[]; settings: Settings; onManage: () => void }) {
  const [edit, setEdit] = useState(false);
  const [order, setOrder] = useState<string[]>(accounts.map((a) => a.key));
  const hold = useRef<{ t: number; x: number; y: number } | null>(null);

  const save = async (o: string[]) => {
    const fresh = await getSettings();
    // Keep accounts that are hidden right now in their old place at the end.
    const rest = (fresh.accountOrder ?? []).filter((k) => !o.includes(k));
    await updateSettings({ accountOrder: [...o, ...rest] });
  };

  const sort = useSortable({
    order,
    onCommit: (next) => {
      setOrder(next);
      save(next);
    },
  });

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
    const { clientX, clientY, pointerId } = e;
    const t = window.setTimeout(() => {
      hold.current = null;
      setEdit(true);
      buzz(18);
      // Keep holding and you can drag that tile straight away.
      sort.begin({ clientX, clientY, pointerId }, key);
    }, HOLD_MS);
    hold.current = { t, x: clientX, y: clientY };
  };

  const hide = async (a: AccountView) => {
    const fresh = await getSettings();
    await updateSettings({ hiddenAccounts: [...new Set([...fresh.hiddenAccounts, a.key])] });
    buzz(10);
    toast(`${a.name} escondida. Volta a mostrá-la em Mais › Contas.`);
  };

  const finish = async () => {
    setEdit(false);
    await save(order);
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div
        ref={sort.containerRef}
        className={`accounts${edit ? ' editing' : ''}`}
        role="list"
        aria-label="Contas"
        onPointerMove={(e) => {
          if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 10) cancelHold();
          sort.move(e);
        }}
        onPointerUp={() => {
          cancelHold();
          sort.end();
        }}
        onPointerCancel={() => {
          cancelHold();
          sort.end();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {list.map((a, i) => (
          <div
            className="acc-cell"
            role="listitem"
            key={a.key}
            ref={sort.ref(a.key)}
            onPointerDown={(e) => {
              if (!edit) return startHold(e, a.key);
              if ((e.target as HTMLElement).closest('.acc-minus')) return;
              sort.begin(e, a.key);
            }}
          >
            <div className="acc" style={{ animationDelay: `${(i % 5) * -0.37}s` }}>
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
