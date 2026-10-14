import { useEffect, useMemo, useState } from 'react';
import type { Tx } from '../lib/types';
import { Sheet } from './shared';
import { CategorizeBlock } from './EditTx';
import { accountName } from '../lib/categories';
import { fmt } from '../lib/text';

/** One uncategorized movement at a time, newest first. Built for clearing a backlog quickly. */
export function Triage({ txs, onClose }: { txs: Tx[]; onClose: () => void }) {
  const open = useMemo(
    () => txs.filter((t) => !t.categoryId && t.kind !== 'transfer').sort((a, b) => b.date.localeCompare(a.date)),
    [txs],
  );
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [total] = useState(open.length);
  const queue = open.filter((t) => !skipped.has(t.id!));
  const t = queue[0];

  useEffect(() => {
    if (!t) onClose();
  }, [t, onClose]);
  if (!t) return null;

  const done = total - open.length;
  return (
    <Sheet onClose={onClose} label="Categorizar movimentos">
      <div className="triage">
        <p className="muted">
          {done} de {total} feitos
        </p>
        <div className="progress">
          <span style={{ width: `${(done / Math.max(1, total)) * 100}%` }} />
        </div>
        <p className="desc">{t.description}</p>
        <p className="muted">
          {accountName(t.account)} · {t.date.split('-').reverse().join('/')}
        </p>
        <p className="amt num">{fmt(t.amount)}</p>
        {/* key resets the suggested pattern for each movement */}
        <CategorizeBlock key={t.id} t={t} onDone={() => undefined} />
        <div className="row">
          <button className="btn ghost" onClick={() => setSkipped(new Set(skipped).add(t.id!))}>
            Saltar
          </button>
          <button className="btn ghost" onClick={onClose}>
            Parar por agora
          </button>
        </div>
      </div>
    </Sheet>
  );
}
