import { useMemo, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import type { Tx } from '../lib/types';
import { accountName } from '../lib/categories';
import { fmt, pretty } from '../lib/text';
import { buildSuggester, triageOrder } from '../lib/suggest';
import { Sheet } from './kit';
import { CategorizeBlock } from './EditTx';

/**
 * Uncategorized movements one at a time. Biggest groups of similar movements come first,
 * so one decision clears many. "Decidir depois" leaves a movement for later.
 */
export function Triage({ txs, intro, onClose, onShowLater }: { txs: Tx[]; intro?: string; onClose: () => void; onShowLater: () => void }) {
  const open = useMemo(() => txs.filter((t) => !t.categoryId && t.kind !== 'transfer'), [txs]);
  const suggest = useMemo(() => buildSuggester(txs), [txs]);
  const [later, setLater] = useState<Set<number>>(new Set());
  const [total] = useState(open.length);
  const queue = useMemo(() => triageOrder(open.filter((t) => !later.has(t.id!))), [open, later]);
  const cur = queue[0];
  const done = total - open.length;

  if (!cur) {
    return (
      <Sheet onClose={onClose} label="Categorizar movimentos">
        <div className="done-state stack">
          <div className="qi">{later.size ? <Clock size={28} /> : <CheckCircle2 size={28} />}</div>
          <h3>{later.size ? `Ficaram ${later.size} para decidir depois` : 'Está tudo categorizado'}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {later.size
              ? 'Encontras estes movimentos em Movimentos › Por categorizar, quando souberes o que foram.'
              : done > 0
                ? `Categorizaste ${done} movimentos. Os próximos parecidos já entram com categoria.`
                : 'Não há nada por categorizar.'}
          </p>
          {later.size > 0 && (
            <button className="btn ghost" onClick={() => setLater(new Set())}>
              Rever os que deixei para depois
            </button>
          )}
          {later.size > 0 && (
            <button className="btn ghost" onClick={onShowLater}>
              Ver na lista de movimentos
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Concluir
          </button>
        </div>
      </Sheet>
    );
  }

  const t = cur.tx;
  return (
    <Sheet onClose={onClose} label="Categorizar movimentos">
      <div className="triage stack">
        {intro && done === 0 && later.size === 0 && <div className="intro">{intro}</div>}
        <div className="stack" style={{ gap: 6 }}>
          <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Por categorizar: {open.length}</span>
            <span className="num">
              {done} feitos{later.size ? ` · ${later.size} para depois` : ''}
            </span>
          </div>
          <div className="progress">
            <span style={{ width: `${(done / Math.max(1, total)) * 100}%` }} />
          </div>
        </div>
        <div>
          <p className="desc">{pretty(t.description)}</p>
          <p className="small muted" style={{ margin: '2px 0 0', wordBreak: 'break-word' }}>
            {accountName(t.account)} · {t.date.split('-').reverse().join('/')} · {t.description}
          </p>
          <p className="amt num" style={{ margin: '6px 0 0' }}>
            {fmt(t.amount)}
          </p>
        </div>
        <CategorizeBlock key={t.id} t={t} onDone={() => undefined} suggestion={suggest(t)} similar={cur.similar} />
        <div className="row2">
          <button className="btn ghost" onClick={() => setLater(new Set(later).add(t.id!))}>
            Decidir depois
          </button>
          <button className="btn ghost" onClick={onClose}>
            Parar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
