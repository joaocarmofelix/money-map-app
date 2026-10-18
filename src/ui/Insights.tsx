import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Category, Tx } from '../lib/types';
import { budgetStatus, extraordinaryTotals, history, monthStats } from '../lib/stats';
import { db, getSettings } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { MONTHS, fmt, today } from '../lib/text';
import { MonthCard } from './MonthCard';
import { Icon } from './icons';
import { CatGrid } from './CatGrid';
import { Bar, CatIcon, MonthPicker, Sheet, StatePill, colorVar, toast, useCats } from './kit';
import { Donut, FlowBars, type Slice } from './charts';
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
  const [choose, setChoose] = useState(false);
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
  const budgetTotal = [...cx.byId.values()].filter((c) => c.budget && !c.extraordinary && !cx.isIncome(c.id) && !cx.isExtra(c.id) && (!c.parentId || !cx.byId.get(c.parentId)?.budget)).reduce((a, c) => a + c.budget!, 0);
  const now = today();
  // Only categories and subcategories with a limit.
  const rows = [...cx.byId.values()]
    .filter((c) => c.budget && !c.extraordinary && !cx.isIncome(c.id) && !cx.isExtra(c.id))
    .map((r) => {
      const spent = s.byCat.get(r.id) ?? 0;
      return { r, spent, st: budgetStatus(spent, r.budget!, month, now) };
    })
    .sort((a, b) => {
      const rank = (x: typeof a) => ({ over: 0, warn: 1, ok: 2 })[x.st.state];
      return rank(a) - rank(b) || b.st.pct - a.st.pct;
    });
  // Each limit counted once: a subcategory's limit is already inside its parent's.
  const counted = rows.filter((x) => !x.r.parentId || !cx.byId.get(x.r.parentId)?.budget);
  const budgetedSpent = counted.reduce((a, x) => a + x.spent, 0);
  const totalSt = budgetTotal ? budgetStatus(budgetedSpent, budgetTotal, month, now) : null;

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
        <MonthCard txs={txs} month={month} />
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
            <h2>Orçamentos</h2>
            {budgetTotal > 0 && (
              <span className="small muted num">
                {fmt(budgetedSpent)} / {fmt(budgetTotal)}
              </span>
            )}
          </div>
          {rows.length === 0 && <p className="muted">Define um limite mensal por categoria para veres aqui se estás a cumprir.</p>}
          {rows.map(({ r, spent, st }) => (
            <button key={r.id} className="budget" onClick={() => (setChoose(false), setBudgetFor(r))}>
              <CatIcon id={r.id} />
              <span className="info">
                <b>{r.parentId ? cx.label(r.id) : r.name}</b>
                <StatePill state={st.state} />
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
          <button className="link" style={{ marginTop: 6 }} onClick={() => (setChoose(true), setBudgetFor(roots.find((r) => !r.budget) ?? roots[0]))}>
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
          choose={choose}
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
  choose,
}: {
  choose?: boolean;
  cat: Category;
  month: string;
  spentBy: Map<string, number>;
  onClose: () => void;
  onSee: (id: string) => void;
}) {
  const cx = useCats();
  const [catId, setCatId] = useState(cat.id);
  const c = cx.byId.get(catId)!;
  const root = (c.parentId && cx.byId.get(c.parentId)) || c;
  const [val, setVal] = useState(c.budget ? String(c.budget) : '');
  const kids = cx.children(c.id);
  const rootKids = cx.children(root.id).filter((k) => !k.hidden);
  const target = (id: string) => {
    setCatId(id);
    setVal(String(cx.byId.get(id)?.budget ?? ''));
  };
  const spent = spentBy.get(c.id) ?? 0;
  const st = c.budget ? budgetStatus(spent, c.budget, month, today()) : null;
  const expenseRoots = cx.roots.filter((r) => !r.income && !r.extraordinary && !r.hidden);
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
            {c.parentId && <span className="small muted">Subcategoria de {root.name}</span>}
            <span className="small muted num">{fmt(spent)} gastos este mês</span>
          </div>
          {st && <StatePill state={st.state} />}
        </div>
        {choose ? (
          <div className="stack" style={{ gap: 8 }}>
            <span className="lbl">Categoria</span>
            <CatGrid
              items={expenseRoots}
              open={rootKids.length ? root.id : undefined}
              pressed={(r) => root.id === r.id}
              onTile={(r) => target(r.id)}
              extra={(r) => <small className={`cat-lim${r.budget ? ' on' : ''}`}>{r.budget ? fmt(r.budget) : 'Sem limite'}</small>}
              panel={
                rootKids.length > 0 && (
                  <>
                    <p className="cp-title">Aplicar o limite a</p>
                    <div className="subcats">
                      <button type="button" aria-pressed={catId === root.id} onClick={() => target(root.id)}>
                        Toda a categoria{root.budget ? ` · ${fmt(root.budget)}` : ''}
                      </button>
                      {rootKids.map((k) => (
                        <button key={k.id} type="button" aria-pressed={catId === k.id} onClick={() => target(k.id)}>
                          <Icon name={k.icon} size={15} />
                          {k.name}
                          {k.budget ? ` · ${fmt(k.budget)}` : ''}
                        </button>
                      ))}
                    </div>
                  </>
                )
              }
            />
          </div>
        ) : (
          c.parentId &&
          rootKids.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="lbl">Aplicar a</span>
              <div className="subcats">
                <button type="button" aria-pressed={catId === root.id} onClick={() => target(root.id)}>
                  Toda a categoria{root.budget ? ` · ${fmt(root.budget)}` : ''}
                </button>
                {rootKids.map((k) => (
                  <button key={k.id} type="button" aria-pressed={catId === k.id} onClick={() => target(k.id)}>
                    <Icon name={k.icon} size={15} />
                    {k.name}
                    {k.budget ? ` · ${fmt(k.budget)}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )
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
              Subcategorias este mês · toca numa para lhe dar um limite só dela
            </p>
            {kids.map((k) => (
              <button key={k.id} className="cat-row" onClick={() => target(k.id)}>
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

      <YearBudgets txs={txs} year={year} />

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

/**
 * Budgets over the year: each monthly limit times the months of the year you track (12, or from the
 * start date in the first year). Against the plan to date it tells you whether you're ahead or need
 * to slow down, and how much a month is left for the rest of the year.
 * Uses today's limits for every month (the app doesn't keep a history of budget changes).
 */
function YearBudgets({ txs, year }: { txs: Tx[]; year: string }) {
  const cx = useCats();
  const settings = useLiveQuery(getSettings, []);
  const now = today();
  const y = Number(year);
  const plan = useMemo(() => {
    if (!settings) return null;
    const budgeted = [...cx.byId.values()].filter((c) => c.budget && !c.extraordinary && !cx.isIncome(c.id));
    if (!budgeted.length) return null;
    // Tracking starts at the start date or the oldest movement, whichever is earlier. Only that first
    // year is partial; every later year counts all 12 months.
    const oldest = txs.reduce((m, t) => (t.date < m ? t.date : m), '9999-99-99');
    const start = settings.trackFrom && settings.trackFrom < oldest ? settings.trackFrom : oldest;
    const startM = Number(start.slice(0, 4)) === y ? Number(start.slice(5, 7)) : Number(start.slice(0, 4)) > y ? 13 : 1;
    if (startM > 12) return null;
    const count = 13 - startM;
    const curY = Number(now.slice(0, 4));
    const curM = Number(now.slice(5, 7));
    let elapsed: number; // months of the plan gone by, the current one in part
    if (y < curY) elapsed = count;
    else if (y > curY || curM < startM) elapsed = 0;
    else {
      const days = new Date(y, curM, 0).getDate();
      elapsed = curM - startM + Number(now.slice(8)) / days;
    }
    const lastM = y < curY ? 12 : Math.min(12, curM);
    const months: string[] = [];
    for (let m = startM; m <= lastM; m++) months.push(`${year}-${String(m).padStart(2, '0')}`);
    const byCat = months.map((ym) => monthStats(txs, ym, cx).byCat);
    const one = (c: Category) => {
      const spent = byCat.reduce((a, m) => a + (m.get(c.id) ?? 0), 0);
      return { c, spent, annual: c.budget! * count, toDate: c.budget! * elapsed };
    };
    const list = budgeted.map(one).sort((a, b) => b.spent / b.annual - a.spent / a.annual);
    // The overall line counts each budget once: a subcategory's limit is already inside its parent's.
    const top = budgeted.filter((c) => !c.parentId || !cx.byId.get(c.parentId)?.budget).map(one);
    const total = top.reduce((a, r) => ({ spent: a.spent + r.spent, annual: a.annual + r.annual, toDate: a.toDate + r.toDate }), { spent: 0, annual: 0, toDate: 0 });
    return { list, total, count, elapsed, startM, done: elapsed >= count };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, year, cx, now, settings?.trackFrom]);

  if (!plan) return null;
  const left = plan.count - plan.elapsed;
  const judge = (spent: number, annual: number, toDate: number) => {
    if (spent > annual) return { state: 'over' as const, text: `${fmt(spent - annual)} acima do limite do ano` };
    if (plan.done) return { state: 'ok' as const, text: `${fmt(annual - spent)} abaixo do limite do ano` };
    if (spent <= toDate) return { state: 'ok' as const, text: `À frente do plano por ${fmt(toDate - spent)}` };
    return { state: 'warn' as const, text: `Cuidado: para fechar o ano dentro, até ${fmt((annual - spent) / left)}/mês` };
  };
  const t = judge(plan.total.spent, plan.total.annual, plan.total.toDate);
  const from = plan.startM === 1 ? 'o ano todo' : `de ${MONTHS[plan.startM - 1].toLowerCase()} a dezembro`;
  return (
    <section className="card">
      <div className="card-head">
        <h2>Orçamentos no ano</h2>
        <StatePill state={t.state} text={t.state === 'ok' ? 'No bom caminho' : t.state === 'warn' ? 'Cuidado' : 'Ultrapassado'} />
      </div>
      <div className="stack" style={{ gap: 6, marginBottom: 12 }}>
        <div className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>
            <b className="num">{fmt(plan.total.spent)}</b> <span className="muted">de {fmt(plan.total.annual)}</span>
          </span>
          <span className="muted num">{Math.round((plan.total.spent / plan.total.annual) * 100)}%</span>
        </div>
        <Bar value={plan.total.spent / plan.total.annual} state={t.state} pace={plan.done ? undefined : plan.elapsed / plan.count} />
        <span className="small" style={{ fontWeight: 700, color: t.state === 'ok' ? 'var(--good)' : t.state === 'warn' ? 'var(--warn)' : 'var(--bad)' }}>
          {t.text}
        </span>
        <span className="small muted">
          Limite do ano: orçamentos × {plan.count} meses ({from}). {!plan.done && 'A marca na barra é onde devias estar hoje.'}
        </span>
      </div>
      {plan.list.map(({ c, spent, annual, toDate }) => {
        const j = judge(spent, annual, toDate);
        return (
          <div key={c.id} className="yb-row">
            <CatIcon id={c.id} size="sm" />
            <div className="yb-main">
              <div className="yb-top">
                <b>{c.parentId ? cx.label(c.id) : c.name}</b>
                <span className="num small">
                  {fmt(spent)} <span className="muted">/ {fmt(annual)}</span>
                </span>
              </div>
              <Bar value={spent / annual} state={j.state} pace={plan.done ? undefined : plan.elapsed / plan.count} />
              <span className="small muted">{j.text}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
