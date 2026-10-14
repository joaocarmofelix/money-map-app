import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Tx } from '../lib/types';
import { fmt } from '../lib/text';
import { MonthPicker, TxRow, useCats } from './kit';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'uncat', label: 'Por categorizar' },
  { id: 'expense', label: 'Gastos' },
  { id: 'income', label: 'Entradas' },
  { id: 'transfer', label: 'Transferências' },
] as const;
export type Filter = (typeof FILTERS)[number]['id'];

const DAY = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });

export function Movements({
  txs,
  month,
  nav,
  filter,
  setFilter,
  cat,
  setCat,
  onOpen,
}: {
  txs: Tx[];
  month: string;
  nav: (d: number) => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
  cat: string | null;
  setCat: (c: string | null) => void;
  onOpen: (t: Tx) => void;
}) {
  const cx = useCats();
  const [q, setQ] = useState('');
  const inCat = (t: Tx) => {
    if (!cat) return true;
    if (cat === '_food') return t.kind === 'expense' && cx.isFood(t.categoryId);
    let cur = t.categoryId ? cx.byId.get(t.categoryId) : undefined;
    while (cur) {
      if (cur.id === cat) return true;
      cur = cur.parentId ? cx.byId.get(cur.parentId) : undefined;
    }
    return false;
  };
  const days = useMemo(() => {
    const list = txs
      .filter((t) => t.date.startsWith(month))
      .filter((t) => {
        if (filter === 'uncat') return !t.categoryId && t.kind !== 'transfer';
        if (filter === 'all') return true;
        return t.kind === filter;
      })
      .filter(inCat)
      .filter((t) => !q || `${t.description} ${t.note ?? ''}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0));
    const m = new Map<string, Tx[]>();
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, month, filter, q, cat, cx]);
  const sum = days.flatMap(([, l]) => l).filter((t) => t.kind !== 'transfer').reduce((a, t) => a + t.amount, 0);
  const catName = cat === '_food' ? 'Comida fora do cartão refeição' : cat ? cx.label(cat) : '';

  return (
    <>
      <header className="appbar">
        <h1>Movimentos</h1>
        <MonthPicker month={month} onChange={nav} />
      </header>
      <div className="stack" style={{ gap: 10 }}>
        <label className="search">
          <Search size={18} aria-hidden />
          <input type="search" placeholder="Procurar" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar movimentos" />
        </label>
        <div className="chips" role="toolbar" aria-label="Filtrar movimentos">
          {cat && (
            <button className="chip" aria-pressed="true" onClick={() => setCat(null)}>
              {catName} <X size={14} style={{ verticalAlign: -2 }} aria-label="Limpar" />
            </button>
          )}
          {FILTERS.map((f) => (
            <button key={f.id} className="chip" aria-pressed={!cat && filter === f.id} onClick={() => (setCat(null), setFilter(f.id))}>
              {f.label}
            </button>
          ))}
        </div>
        {days.length > 0 && (
          <p className="small muted" style={{ margin: 0 }}>
            {days.reduce((a, [, l]) => a + l.length, 0)} movimentos · <span className="num">{fmt(sum)}</span>
          </p>
        )}
        {days.length === 0 && <p className="empty muted">Nada para mostrar neste mês.</p>}
        {days.map(([d, list]) => (
          <section key={d} className="card day-card">
            <p className="day">{DAY.format(new Date(`${d}T12:00:00`))}</p>
            {list.map((t) => (
              <TxRow key={t.id} t={t} onClick={() => onOpen(t)} />
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
