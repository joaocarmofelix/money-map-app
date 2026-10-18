import { useMemo, useState } from 'react';
import { needsCategory } from '../lib/tags';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { Tx } from '../lib/types';
import { fmt } from '../lib/text';
import { MonthPicker, Sheet, TxRow, useCats } from './kit';
import { Icon } from './icons';
import { CatGrid } from './CatGrid';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'uncat', label: 'Por categorizar' },
  { id: 'expense', label: 'Gastos' },
  { id: 'income', label: 'Entradas' },
  { id: 'transfer', label: 'Transferências' },
] as const;
export type Filter = (typeof FILTERS)[number]['id'];

const DAY = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
const DAY_Y = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const PAGE = 40;
function dayLabel(d: string, thisYear: string) {
  const date = new Date(`${d}T12:00:00`);
  if (Number.isNaN(date.getTime())) return d;
  return (d.startsWith(thisYear) ? DAY : DAY_Y).format(date);
}

export function Movements({
  txs,
  month,
  nav,
  filter,
  setFilter,
  cats,
  setCats,
  onOpen,
}: {
  txs: Tx[];
  month: string;
  nav: (d: number) => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
  cats: string[];
  setCats: (c: string[]) => void;
  onOpen: (t: Tx) => void;
}) {
  const cx = useCats();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const tags = useMemo(() => [...new Set(txs.flatMap((t) => t.tags ?? []))].sort(), [txs]);
  const [picking, setPicking] = useState(false);
  // A movement matches when its category, or any category above it, is one of the chosen ones.
  const inCat = (t: Tx) => {
    if (!cats.length) return true;
    let cur = t.categoryId ? cx.byId.get(t.categoryId) : undefined;
    while (cur) {
      if (cats.includes(cur.id)) return true;
      cur = cur.parentId ? cx.byId.get(cur.parentId) : undefined;
    }
    return false;
  };

  const days = useMemo(() => {
    const list = txs
      .filter((t) => all || t.date.startsWith(month))
      .filter((t) => {
        if (filter === 'uncat') return needsCategory(t);
        if (filter === 'all') return true;
        return t.kind === filter;
      })
      .filter(inCat)
      .filter((t) => !tag || t.tags?.includes(tag))
      .filter((t) => !q || `${t.description} ${t.note ?? ''}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0));
    const m = new Map<string, Tx[]>();
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, month, filter, q, cats, cx, tag, all]);
  const thisYear = new Date().getFullYear().toString();
  const sum = days.flatMap(([, l]) => l).filter((t) => t.kind !== 'transfer').reduce((a, t) => a + t.amount, 0);

  return (
    <>
      <header className="appbar">
        <h1>Movimentos</h1>
        {!all && <MonthPicker month={month} onChange={nav} />}
      </header>
      <div className="stack" style={{ gap: 10 }}>
        <div className="search-row">
          <label className="search">
            <Search size={18} aria-hidden />
            <input type="search" placeholder="Procurar" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar movimentos" />
          </label>
          <button className={`filter-btn${cats.length ? ' on' : ''}`} onClick={() => setPicking(true)} aria-label={cats.length ? `Categorias: ${cats.length} escolhidas` : 'Filtrar por categoria'}>
            <SlidersHorizontal size={19} />
            {cats.length > 0 && <span className="filter-n">{cats.length}</span>}
          </button>
        </div>
        {cats.length > 0 && (
          <div className="chips" role="toolbar" aria-label="Categorias escolhidas">
            {cats.map((id) => (
              <button key={id} className="chip" aria-pressed="true" onClick={() => setCats(cats.filter((x) => x !== id))}>
                {cx.label(id)} <X size={14} style={{ verticalAlign: -2 }} aria-label="Tirar" />
              </button>
            ))}
          </div>
        )}
        <div className="seg" role="group" aria-label="Período">
          <button aria-pressed={!all} onClick={() => (setAll(false), setShown(PAGE))}>
            Por mês
          </button>
          <button aria-pressed={all} onClick={() => (setAll(true), setShown(PAGE))}>
            Tudo
          </button>
        </div>
        <div className="chips" role="toolbar" aria-label="Filtrar movimentos">
          {FILTERS.map((f) => (
            <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="chips" role="toolbar" aria-label="Filtrar por etiqueta">
            {tags.map((x) => (
              <button key={x} className="chip" aria-pressed={tag === x} onClick={() => setTag(tag === x ? null : x)}>
                # {x}
              </button>
            ))}
          </div>
        )}
        {days.length > 0 && (
          <p className="small muted" style={{ margin: 0 }}>
            {days.reduce((a, [, l]) => a + l.length, 0)} movimentos · <span className="num">{fmt(sum)}</span>
          </p>
        )}
        {days.length === 0 && <p className="empty muted">{all ? 'Nada para mostrar.' : 'Nada para mostrar neste mês.'}</p>}
        {(all ? days.slice(0, shown) : days).map(([d, list]) => (
          <section key={d} className="card day-card">
            <p className="day">{dayLabel(d, thisYear)}</p>
            {list.map((t) => (
              <TxRow key={t.id} t={t} onClick={() => onOpen(t)} />
            ))}
          </section>
        ))}
        {picking && <CategoryFilter selected={cats} onChange={setCats} onClose={() => setPicking(false)} />}
        {all && days.length > shown && (
          <button className="btn ghost" onClick={() => setShown((n) => n + PAGE)}>
            Mostrar mais dias ({days.length - shown})
          </button>
        )}
      </div>
    </>
  );
}

/** Pick one or more categories or subcategories to filter the list. Changes apply straight away. */
function CategoryFilter({ selected, onChange, onClose }: { selected: string[]; onChange: (c: string[]) => void; onClose: () => void }) {
  const cx = useCats();
  const [open, setOpen] = useState<string | undefined>();
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const groups = [
    { title: 'Gastos', roots: cx.roots.filter((r) => !r.income && !r.hidden) },
    { title: 'Entradas', roots: cx.roots.filter((r) => r.income && !r.hidden) },
  ];
  return (
    <Sheet
      onClose={onClose}
      label="Filtrar por categoria"
      title="Categorias"
      tall
      footer={
        <div className="row2">
          <button className="btn ghost" onClick={() => onChange([])} disabled={!selected.length}>
            Limpar
          </button>
          <button className="btn" onClick={onClose}>
            Ver movimentos
          </button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <p className="small muted" style={{ margin: 0 }}>
          Toca para escolher. As que têm uma seta abrem as subcategorias.
        </p>
        {groups.map((g) => {
          const openRoot = g.roots.find((r) => r.id === open);
          const kids = openRoot ? cx.children(openRoot.id).filter((k) => !k.hidden) : [];
          return (
            <div key={g.title} className="stack" style={{ gap: 8 }}>
              <span className="lbl">{g.title}</span>
              <CatGrid
                items={g.roots}
                open={openRoot?.id}
                pressed={(r) => selected.includes(r.id) || cx.children(r.id).some((k) => selected.includes(k.id))}
                onTile={(r) => (cx.children(r.id).some((k) => !k.hidden) ? setOpen(open === r.id ? undefined : r.id) : toggle(r.id))}
                extra={(r) => {
                  const n = cx.children(r.id).filter((k) => selected.includes(k.id)).length;
                  return n > 0 && !selected.includes(r.id) ? <small className="cat-lim on">{n} {n === 1 ? 'sub' : 'subs'}</small> : null;
                }}
                panel={
                  openRoot && (
                    <div className="subcats">
                      <button type="button" aria-pressed={selected.includes(openRoot.id)} onClick={() => toggle(openRoot.id)}>
                        Toda a categoria
                      </button>
                      {kids.map((k) => (
                        <button key={k.id} type="button" disabled={selected.includes(openRoot.id)} aria-pressed={selected.includes(k.id) || selected.includes(openRoot.id)} onClick={() => toggle(k.id)}>
                          <Icon name={k.icon} size={15} />
                          {k.name}
                        </button>
                      ))}
                    </div>
                  )
                }
              />
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
