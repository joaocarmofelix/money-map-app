import { useMemo, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import type { Category, Tx } from '../lib/types';
import { budgetStatus, history, monthStats } from '../lib/stats';
import { db } from '../lib/db';
import { fmt, today } from '../lib/text';
import { Bar, CatIcon, MonthPicker, Sheet, StatePill, colorVar, toast, useCats } from './kit';
import { Donut, MonthBars, type Slice } from './charts';

export function Insights({
  txs,
  month,
  setMonth,
  nav,
  onCategory,
}: {
  txs: Tx[];
  month: string;
  setMonth: (ym: string) => void;
  nav: (d: number) => void;
  onCategory: (id: string) => void;
}) {
  const cx = useCats();
  const s = useMemo(() => monthStats(txs, month, cx), [txs, month, cx]);
  const hist = useMemo(() => history(txs, month, 6, cx), [txs, month, cx]);
  const [budgetFor, setBudgetFor] = useState<Category | null>(null);

  const slices: Slice[] = useMemo(() => {
    const named = s.byRoot.filter((r) => r.id !== '_none');
    const top = named.slice(0, 5);
    const rest = named.slice(5).reduce((a, r) => a + r.total, 0);
    const none = s.byRoot.find((r) => r.id === '_none');
    const out: Slice[] = top.map((r) => {
      const c = cx.byId.get(r.id)!;
      return { id: r.id, label: c.name, value: r.total, color: colorVar(c) };
    });
    if (rest > 0) out.push({ id: '_rest', label: 'Restantes', value: rest, color: 'var(--ink-3)' });
    if (none) out.push({ id: '_none', label: 'Por categorizar', value: none.total, color: 'var(--line)' });
    return out;
  }, [s, cx]);

  const roots = cx.roots.filter((r) => !r.income);
  const budgetTotal = roots.reduce((a, r) => a + (r.budget ?? 0), 0);
  const now = today();
  const rows = roots
    .map((r) => {
      const spent = s.byCat.get(r.id) ?? 0;
      const st = r.budget ? budgetStatus(spent, r.budget, month, now) : null;
      return { r, spent, st };
    })
    .filter((x) => x.st || x.spent > 0)
    .sort((a, b) => {
      const rank = (x: typeof a) => (x.st ? { over: 0, warn: 1, ok: 2 }[x.st.state] : 3);
      return rank(a) - rank(b) || (b.st?.pct ?? 0) - (a.st?.pct ?? 0) || b.spent - a.spent;
    });
  const totalSt = budgetTotal ? budgetStatus(s.spent, budgetTotal, month, now) : null;

  return (
    <>
      <header className="appbar">
        <h1>Resumo</h1>
        <MonthPicker month={month} onChange={nav} />
      </header>
      <div className="stack">
        <section className="card">
          <div className="card-head">
            <h2>Para onde foi o dinheiro</h2>
            {totalSt && <StatePill state={totalSt.state} />}
          </div>
          {s.spent > 0 ? (
            <Donut slices={slices} total={s.spent} caption="gastos no mês" />
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Sem gastos neste mês.
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Últimos 6 meses</h2>
          </div>
          <MonthBars
            data={hist.map((h) => ({ ym: h.ym, value: h.spent, empty: !h.hasData }))}
            selected={month}
            limit={budgetTotal || undefined}
            onSelect={setMonth}
          />
          <div className="chart-key">
            <span>
              <i style={{ background: 'var(--primary)' }} />
              Gastos
            </span>
            {budgetTotal > 0 && (
              <span>
                <i className="dash" />
                Soma dos orçamentos
              </span>
            )}
            <span>
              <i style={{ background: 'var(--bad)' }} />
              Acima do orçamento
            </span>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Orçamentos</h2>
            {totalSt && (
              <span className="small muted num">
                {fmt(s.spent)} / {fmt(budgetTotal)}
              </span>
            )}
          </div>
          {rows.length === 0 && <p className="muted">Define um limite mensal por categoria para veres aqui se estás a cumprir.</p>}
          {rows.map(({ r, spent, st }) => (
            <button key={r.id} className="budget" onClick={() => setBudgetFor(r)}>
              <CatIcon id={r.id} />
              <span className="info">
                <b>{r.name}</b>
                {st ? <StatePill state={st.state} /> : <span className="link small">Definir limite</span>}
              </span>
              {st ? (
                <>
                  <Bar value={st.pct} state={st.state} pace={st.elapsed} />
                  <span className="meta num">
                    <span>
                      {fmt(spent)} de {fmt(r.budget!)}
                    </span>
                    <span>{st.left >= 0 ? `Restam ${fmt(st.left)}` : `Passaste ${fmt(-st.left)}`}</span>
                  </span>
                </>
              ) : (
                <span className="meta num">
                  <span>{fmt(spent)} este mês</span>
                </span>
              )}
            </button>
          ))}
          <button className="link" style={{ marginTop: 6 }} onClick={() => setBudgetFor(roots.find((r) => !r.budget) ?? roots[0])}>
            <Plus size={16} /> Definir orçamento
          </button>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Comida fora do cartão refeição</h2>
            <StatePill state={s.food === 0 ? 'ok' : 'warn'} text={s.food === 0 ? 'Objetivo cumprido' : 'Objetivo: 0 €'} />
          </div>
          <MonthBars data={hist.map((h) => ({ ym: h.ym, value: h.food, empty: !h.hasData }))} selected={month} color="var(--s4)" onSelect={setMonth} />
          <button className="link" onClick={() => onCategory('_food')}>
            Ver compras de {fmt(s.food)} <ChevronRight size={16} />
          </button>
        </section>
      </div>
      {budgetFor && (
        <BudgetSheet
          cat={budgetFor}
          month={month}
          spentBy={s.byCat}
          onClose={() => setBudgetFor(null)}
          onSee={(id) => {
            setBudgetFor(null);
            onCategory(id);
          }}
        />
      )}
    </>
  );
}

function BudgetSheet({
  cat,
  month,
  spentBy,
  onClose,
  onSee,
}: {
  cat: Category;
  month: string;
  spentBy: Map<string, number>;
  onClose: () => void;
  onSee: (id: string) => void;
}) {
  const cx = useCats();
  const [catId, setCatId] = useState(cat.id);
  const c = cx.byId.get(catId)!;
  const [val, setVal] = useState(c.budget ? String(c.budget) : '');
  const kids = cx.children(c.id);
  const spent = spentBy.get(c.id) ?? 0;
  const st = c.budget ? budgetStatus(spent, c.budget, month, today()) : null;
  const expenseRoots = cx.roots.filter((r) => !r.income);

  async function save() {
    const n = parseFloat(val.replace(',', '.'));
    await db.categories.update(c.id, { budget: Number.isFinite(n) && n > 0 ? n : undefined });
    toast(Number.isFinite(n) && n > 0 ? `Orçamento de ${c.name}: ${fmt(n)}/mês` : `Orçamento de ${c.name} removido`);
    onClose();
  }

  return (
    <Sheet onClose={onClose} label={`Orçamento de ${c.name}`}>
      <div className="stack">
        <div className="sheet-head">
          <CatIcon id={c.id} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{c.name}</h3>
            <span className="small muted num">{fmt(spent)} gastos este mês</span>
          </div>
          {st && <StatePill state={st.state} />}
        </div>
        {cat.budget === undefined && !cat.parentId && (
          <div className="field">
            <label htmlFor="b-cat">Categoria</label>
            <select
              id="b-cat"
              value={catId}
              onChange={(e) => {
                setCatId(e.target.value);
                setVal(String(cx.byId.get(e.target.value)?.budget ?? ''));
              }}
            >
              {expenseRoots.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.emoji} {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {st && (
          <div className="stack" style={{ gap: 6 }}>
            <Bar value={st.pct} state={st.state} pace={st.elapsed} />
            <span className="small muted">
              {st.state === 'over'
                ? `Passaste ${fmt(-st.left)} do limite. Corta nesta categoria até ao fim do mês.`
                : st.state === 'warn'
                  ? `Restam ${fmt(st.left)}. Ao ritmo atual chegas a ${fmt(st.projected)} no fim do mês.`
                  : `Restam ${fmt(st.left)}. Estás dentro do ritmo.`}
            </span>
          </div>
        )}
        <div className="field">
          <label htmlFor="b-val">Limite mensal</label>
          <input id="b-val" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="Sem limite" />
        </div>
        <button className="btn" onClick={save}>
          Guardar orçamento
        </button>
        {kids.length > 0 && (
          <div>
            <p className="small muted" style={{ margin: '4px 0' }}>
              Subcategorias este mês
            </p>
            {kids.map((k) => (
              <button key={k.id} className="cat-row" onClick={() => onSee(k.id)}>
                <CatIcon id={k.id} size="sm" />
                <span>
                  {k.name}
                  {k.budget ? <small>Limite {fmt(k.budget)}</small> : null}
                </span>
                <span className="num">{fmt(spentBy.get(k.id) ?? 0)}</span>
              </button>
            ))}
          </div>
        )}
        <button className="btn ghost" onClick={() => onSee(c.id)}>
          Ver movimentos
        </button>
      </div>
    </Sheet>
  );
}
