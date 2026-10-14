import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Category, Tx } from '../lib/types';
import { budgetStatus, extraordinaryTotals, history, monthStats } from '../lib/stats';
import { db } from '../lib/db';
import { fmt, today } from '../lib/text';
import { Bar, CatIcon, MonthPicker, Sheet, StatePill, colorVar, toast, useCats } from './kit';
import { Donut, FlowBars, MonthBars, type Slice } from './charts';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [year, setYear] = useState(month.slice(0, 4));
  const [budgetFor, setBudgetFor] = useState<Category | null>(null);
  const extras = useMemo(() => [...extraordinaryTotals(txs, cx).entries()], [txs, cx]);

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

  const roots = cx.roots.filter((r) => !r.income && !r.extraordinary);
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
        {mode === 'month' ? (
          <MonthPicker month={month} onChange={nav} />
        ) : (
          <YearPicker year={year} onChange={(d) => setYear(String(Number(year) + d))} />
        )}
      </header>
      <div className="seg" role="group" aria-label="Período" style={{ marginBottom: 14 }}>
        <button aria-pressed={mode === 'month'} onClick={() => setMode('month')}>
          Mês
        </button>
        <button aria-pressed={mode === 'year'} onClick={() => (setYear(month.slice(0, 4)), setMode('year'))}>
          Ano
        </button>
      </div>
      {mode === 'year' ? (
        <YearView
          txs={txs}
          year={year}
          onMonth={(ym) => {
            setMonth(ym);
            setMode('month');
          }}
          onCategory={onCategory}
        />
      ) : (
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
            <h2>Entrou, saiu e poupaste</h2>
            <span className="small muted">6 meses</span>
          </div>
          <FlowBars data={hist.map((h) => ({ ym: h.ym, income: h.income, spent: h.spent, saved: h.saved, empty: !h.hasData }))} selected={month} onSelect={setMonth} />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Gastos e orçamento</h2>
            <span className="small muted">6 meses</span>
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


        {extras.map(([id, e]) => {
          const r = cx.byId.get(id)!;
          const thisMonth = s.extraByRoot.find((x) => x.id === id)?.total ?? 0;
          return (
            <section className="card" key={id}>
              <div className="card-head">
                <h2>{r.name}</h2>
                <span className="pill info">Extraordinária</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <b className="num" style={{ fontSize: 24, letterSpacing: '-0.02em' }}>
                  {fmt(e.total)}
                </b>
                <span className="small muted num">{thisMonth > 0 ? `${fmt(thisMonth)} neste mês` : 'no total'}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                {[...e.byCat.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([cid, v]) => (
                    <button key={cid} className="cat-row" onClick={() => onCategory(cid)}>
                      <CatIcon id={cid} size="sm" />
                      <span>{cx.byId.get(cid)?.name}</span>
                      <span className="num">{fmt(v)}</span>
                    </button>
                  ))}
              </div>
              <p className="small muted" style={{ margin: '6px 0 0' }}>
                Fica fora dos gastos do mês e dos orçamentos.
              </p>
            </section>
          );
        })}
      </div>
      )}
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
  const expenseRoots = cx.roots.filter((r) => !r.income && !r.extraordinary);

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
                  {r.name}
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

function YearPicker({ year, onChange }: { year: string; onChange: (d: number) => void }) {
  const now = today().slice(0, 4);
  return (
    <div className="month-pick">
      <button className="icon-btn" onClick={() => onChange(-1)} aria-label="Ano anterior">
        <ChevronLeft size={18} />
      </button>
      <span>{year}</span>
      <button className="icon-btn" onClick={() => onChange(1)} disabled={year >= now} aria-label="Ano seguinte">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

/** The whole year at a glance: totals, the twelve months side by side, and where the money went. */
function YearView({ txs, year, onMonth, onCategory }: { txs: Tx[]; year: string; onMonth: (ym: string) => void; onCategory: (id: string) => void }) {
  const cx = useCats();
  const months = useMemo(() => history(txs, `${year}-12`, 12, cx), [txs, year, cx]);
  const withData = months.filter((m) => m.hasData);
  const tot = withData.reduce((a, m) => ({ income: a.income + m.income, spent: a.spent + m.spent, saved: a.saved + m.saved }), { income: 0, spent: 0, saved: 0 });
  const rate = tot.income > 0 ? Math.round((tot.saved / tot.income) * 100) : null;

  // Spending per top-level category over the year.
  const byRoot = useMemo(() => {
    const m = new Map<string, number>();
    for (const mo of withData) {
      const st = monthStats(txs, mo.ym, cx);
      for (const r of st.byRoot) m.set(r.id, (m.get(r.id) ?? 0) + r.total);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, year, cx]);
  const slices: Slice[] = [];
  byRoot.filter(([id]) => id !== '_none').slice(0, 5).forEach(([id, v]) => {
    const c = cx.byId.get(id)!;
    slices.push({ id, label: c.name, value: v, color: colorVar(c) });
  });
  const rest = byRoot.filter(([id]) => id !== '_none').slice(5).reduce((a, [, v]) => a + v, 0);
  if (rest > 0) slices.push({ id: '_rest', label: 'Restantes', value: rest, color: 'var(--ink-3)' });
  const none = byRoot.find(([id]) => id === '_none');
  if (none) slices.push({ id: '_none', label: 'Por categorizar', value: none[1], color: 'var(--line)' });

  if (!withData.length) {
    return (
      <section className="card empty">
        <h2>Sem movimentos em {year}</h2>
        <p>Importa extratos deste ano para veres o resumo anual.</p>
      </section>
    );
  }
  const n = withData.length;
  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <h2>{year} até agora</h2>
          <span className="small muted">
            {n} {n === 1 ? 'mês' : 'meses'} com dados
          </span>
        </div>
        <dl className="year-figs">
          <div>
            <dt>Entrou</dt>
            <dd className="num" style={{ color: 'var(--good)' }}>{fmt(tot.income)}</dd>
          </div>
          <div>
            <dt>Saiu</dt>
            <dd className="num">{fmt(tot.spent)}</dd>
          </div>
          <div>
            <dt>Poupaste</dt>
            <dd className="num">{fmt(tot.saved)}</dd>
          </div>
          <div>
            <dt>Taxa de poupança</dt>
            <dd className="num">{rate === null ? '—' : `${rate}%`}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Mês a mês</h2>
          <span className="small muted">Toca num mês para o abrir</span>
        </div>
        <FlowBars data={months.map((h) => ({ ym: h.ym, income: h.income, spent: h.spent, saved: h.saved, empty: !h.hasData }))} onSelect={(ym) => months.find((m) => m.ym === ym)?.hasData && onMonth(ym)} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Para onde foi o dinheiro</h2>
        </div>
        <Donut slices={slices} total={tot.spent} caption={`gastos em ${year}`} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Por categoria</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="cat-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Total</th>
                <th>Média/mês</th>
                <th>Orçamento</th>
              </tr>
            </thead>
            <tbody>
              {byRoot.map(([id, v]) => {
                const c = cx.byId.get(id);
                const avg = v / n;
                const st = c?.budget ? budgetStatus(avg, c.budget, '0000-00', today()) : null;
                return (
                  <tr key={id} onClick={() => id !== '_none' && onCategory(id)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span>
                        <CatIcon id={c?.id} size="sm" />
                        {c?.name ?? 'Por categorizar'}
                      </span>
                    </td>
                    <td className="num">{fmt(v)}</td>
                    <td className="num">{fmt(avg)}</td>
                    <td>{st ? <StatePill state={st.state} text={`${Math.round(st.pct * 100)}%`} /> : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          Orçamento: média mensal comparada com o limite de cada mês.
        </p>
      </section>
    </div>
  );
}
