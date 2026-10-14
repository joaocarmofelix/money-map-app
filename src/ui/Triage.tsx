import { useEffect, useMemo, useState } from 'react';
import type { Tx } from '../lib/types';
import { accountName } from '../lib/categories';
import { fmt, pretty } from '../lib/text';
import { Sheet } from './kit';
import { CategorizeBlock } from './EditTx';

/** One uncategorized movement at a time, newest first. Built for clearing a backlog quickly. */
export function Triage({ txs, onClose }: { txs: Tx[]; onClose: () => void }) {
  const open = useMemo(
    () => txs.filter((t) => !t.categoryId && t.kind !== 'transfer').sort((a, b) => b.date.localeCompare(a.date)),
    [txs],
  );
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [total] = useState(open.length);
  const t = open.filter((x) => !skipped.has(x.id!))[0];

  useEffect(() => {
    if (!t) onClose();
  }, [t, onClose]);
  if (!t) return null;
  const done = total - open.length;

  return (
    <Sheet onClose={onClose} label="Categorizar movimentos">
      <div className="triage stack">
        <div className="stack" style={{ gap: 6 }}>
          <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Categorizar</span>
            <span className="num">
              {done} de {total}
            </span>
          </div>
          <div className="progress">
            <span style={{ width: `${(done / Math.max(1, total)) * 100}%` }} />
          </div>
        </div>
        <div>
          <p className="desc">{pretty(t.description)}</p>
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            {accountName(t.account)} · {t.date.split('-').reverse().join('/')} · {t.description}
          </p>
          <p className="amt num" style={{ margin: '6px 0 0' }}>
            {fmt(t.amount)}
          </p>
        </div>
        <CategorizeBlock key={t.id} t={t} onDone={() => undefined} />
        <div className="row2">
          <button className="btn ghost" onClick={() => setSkipped(new Set(skipped).add(t.id!))}>
            Saltar
          </button>
          <button className="btn ghost" onClick={onClose}>
            Parar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
