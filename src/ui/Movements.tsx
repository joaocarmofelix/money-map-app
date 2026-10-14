import { useMemo, useState } from 'react';
import type { Tx } from '../lib/types';
import { TxRow } from './shared';
import { FOOD_IDS } from '../lib/categories';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'uncat', label: 'Por categorizar' },
  { id: 'food', label: 'Comida' },
  { id: 'expense', label: 'Gastos' },
  { id: 'income', label: 'Entradas' },
  { id: 'transfer', label: 'Transferências' },
] as const;
export type Filter = (typeof FILTERS)[number]['id'];

const WEEKDAY = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });

export function Movements({
  txs,
  month,
  filter,
  setFilter,
  onOpen,
}: {
  txs: Tx[];
  month: string;
  filter: Filter;
  setFilter: (f: Filter) => void;
  onOpen: (t: Tx) => void;
}) {
  const [q, setQ] = useState('');
  const days = useMemo(() => {
    const list = txs
      .filter((t) => t.date.startsWith(month))
      .filter((t) => {
        if (filter === 'uncat') return !t.categoryId && t.kind !== 'transfer';
        if (filter === 'food') return t.kind === 'expense' && FOOD_IDS.has(t.categoryId ?? '');
        if (filter === 'all') return true;
        return t.kind === filter;
      })
      .filter((t) => !q || `${t.description} ${t.note ?? ''}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0));
    const m = new Map<string, Tx[]>();
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [txs, month, filter, q]);

  return (
    <>
      <div className="chips" role="toolbar" aria-label="Filtrar movimentos">
        {FILTERS.map((f) => (
          <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="field" style={{ marginTop: 0 }}>
        <input type="search" placeholder="Procurar" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar movimentos" />
      </div>
      {days.length === 0 && <p className="empty">Nada para mostrar neste mês.</p>}
      {days.map(([d, list]) => (
        <section key={d}>
          <p className="day">{WEEKDAY.format(new Date(`${d}T12:00:00`))}</p>
          {list.map((t) => (
            <TxRow key={t.id} t={t} onClick={() => onOpen(t)} />
          ))}
        </section>
      ))}
    </>
  );
}
