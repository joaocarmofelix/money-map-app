import { useMemo } from 'react';
import { ArrowDownToLine, ChevronRight, Flame, AlertTriangle, Tags, Target, FileWarning, Upload, Utensils } from 'lucide-react';
import type { Settings, Tx } from '../lib/types';
import { accountBalances, budgetStatus, investBalances, monthStats, potBalances } from '../lib/stats';
import { fmt, monthLabel, shiftMonth, today } from '../lib/text';
import { investName } from '../lib/categories';
import { Bar, TxRow, useCats } from './kit';

const ACC_META: Record<string, { name: string; initials: string; color: string }> = {
  mil: { name: 'Millennium', initials: 'M', color: 'var(--s8)' },
  bkt: { name: 'Bankinter', initials: 'B', color: 'var(--s2)' },
};

const DATE_FMT = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

export function Home({
  txs,
  settings,
  month,
  go,
  onOpen,
  onTriage,
  onFood,
}: {
  txs: Tx[];
  settings: Settings;
  month: string;
  go: (where: 'insights' | 'movements' | 'import' | 'setup') => void;
  onOpen: (t: Tx) => void;
  onTriage: () => void;
  onFood: () => void;
}) {
  const cx = useCats();
  const s = useMemo(() => monthStats(txs, month, cx), [txs, month, cx]);
  const prev = useMemo(() => monthStats(txs, shiftMonth(month, -1), cx), [txs, month, cx]);
  const balances = useMemo(() => accountBalances(txs), [txs]);
  const pots = useMemo(() => potBalances(txs, settings), [txs, settings]);
  const invest = useMemo(() => investBalances(txs, settings), [txs, settings]);
  const recent = useMemo(
    () => [...txs].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)).slice(0, 5),
    [txs],
  );
  const uncat = txs.filter((t) => !t.categoryId && t.kind !== 'transfer').length;
  const first = settings.ownerNames[0]?.split(' ')[0];
  const name = first ? first[0] + first.slice(1).toLowerCase() : '';

  const accounts = (balances.mil?.balance ?? 0) + (balances.bkt?.balance ?? 0);
  const savings = balances['mil-apparte']?.balance ?? 0;
  const invested = invest.reduce((a, b) => a + b.invested, 0);
  const total = accounts + savings + invested;

  const budgetTotal = cx.roots.filter((r) => !r.income).reduce((a, r) => a + (r.budget ?? 0), 0);
  const budgetAlerts = cx.roots
    .filter((r) => r.budget)
    .map((r) => ({ r, st: budgetStatus(s.byCat.get(r.id) ?? 0, r.budget!, month, today()) }))
    .filter((x) => x.st.state !== 'ok')
    .sort((a, b) => b.st.pct - a.st.pct);
  const lastStatement = Object.values(balances).reduce((m, b) => (b.date > m ? b.date : m), '');
  const stale = lastStatement && Date.parse(today()) - Date.parse(lastStatement) > 35 * 86400000;
  const totalSt = budgetTotal > 0 ? budgetStatus(s.spent, budgetTotal, month, today()) : null;

  if (!txs.length) {
    return (
      <>
        <header className="appbar">
          <h1>
            {name ? `Olá, ${name}` : 'Olá'}
            <span className="sub">Bem-vindo à MoneyMap</span>
          </h1>
        </header>
        <div className="stack">
          <section className="card empty">
            <div className="qi">
              <Upload size={26} />
            </div>
            <h2>Importa o teu primeiro extrato</h2>
            <p>Usa o PDF mensal do Millennium ou o Excel do Bankinter. A app trata do resto.</p>
            <button className="btn" onClick={() => go('import')}>
              Importar extrato
            </button>
          </section>
          {settings.ownerNames.length === 0 && (
            <button className="alert info" onClick={() => go('setup')}>
              <span className="ic">
                <Target size={18} />
              </span>
              <span className="al-t">
                <b>Configura a app primeiro</b>O teu nome, a data de início e os saldos que já tinhas.
              </span>
              <ChevronRight size={18} className="muted" />
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <header className="appbar">
        <h1>
          {name ? `Olá, ${name}` : 'Olá'}
          <span className="sub">{cap(DATE_FMT.format(new Date()))}</span>
        </h1>
      </header>

      <div className="stack">
        <section className="hero" aria-label="Património total">
          <div className="label">Património total</div>
          <div className="big num">{fmt(total)}</div>
          <div className="split num">
            <span>
              Contas<b>{fmt(accounts)}</b>
            </span>
            <span>
              Appartes<b>{fmt(savings)}</b>
            </span>
            {invest.length > 0 && (
              <span>
                Investido<b>{fmt(invested)}</b>
              </span>
            )}
          </div>
        </section>

        <div className="accounts" role="list" aria-label="Contas">
          {(['mil', 'bkt'] as const)
            .filter((id) => balances[id])
            .map((id) => (
              <div className="acc" role="listitem" key={id}>
                <div className="top">
                  <span className="badge" style={{ background: ACC_META[id].color }}>
                    {ACC_META[id].initials}
                  </span>
                  {ACC_META[id].name}
                </div>
                <div className="val num">{fmt(balances[id].balance)}</div>
                <div className="when">Extrato de {short(balances[id].date)}</div>
              </div>
            ))}
          {balances['mil-apparte'] && (
            <div className="acc" role="listitem">
              <div className="top">
                <span className="badge" style={{ background: 'var(--s3)' }}>
                  🐷
                </span>
                Appartes
              </div>
              <div className="val num">{fmt(savings)}</div>
              <div className="when">
                {pots
                  .slice(0, 3)
                  .map((p) => p.pot)
                  .join(', ') || 'Poupança'}
              </div>
            </div>
          )}
          {invest.map((i) => (
            <div className="acc" role="listitem" key={i.id}>
              <div className="top">
                <span className="badge" style={{ background: 'var(--s1)' }}>
                  📈
                </span>
                {investName(i.id)}
              </div>
              <div className="val num">{fmt(i.invested)}</div>
              <div className="when">Investido</div>
            </div>
          ))}
        </div>

        {(budgetAlerts.length > 0 || uncat > 0 || stale) && (
          <div className="stack" style={{ gap: 8 }}>
            {budgetAlerts.slice(0, 2).map(({ r, st }) => (
              <button key={r.id} className={`alert ${st.state}`} onClick={() => go('insights')}>
                <span className="ic">{st.state === 'over' ? <Flame size={18} /> : <AlertTriangle size={18} />}</span>
                <span className="al-t">
                  <b>
                    {r.emoji} {r.name}: {st.state === 'over' ? 'orçamento ultrapassado' : 'perto do limite'}
                  </b>
                  {st.state === 'over'
                    ? `Passaste ${fmt(-st.left)} do limite. Hora de apertar o cinto.`
                    : `Restam ${fmt(st.left)} de ${fmt(r.budget!)}${st.projected > r.budget! ? `, ao ritmo atual vais gastar ${fmt(st.projected)}` : ''}.`}
                </span>
                <ChevronRight size={18} className="muted" />
              </button>
            ))}
            {uncat > 0 && (
              <button className="alert info" onClick={onTriage}>
                <span className="ic">
                  <Tags size={18} />
                </span>
                <span className="al-t">
                  <b>{uncat} movimentos por categorizar</b>Categoriza um e a app trata dos parecidos.
                </span>
                <ChevronRight size={18} className="muted" />
              </button>
            )}
            {stale && (
              <button className="alert warn" onClick={() => go('import')}>
                <span className="ic">
                  <FileWarning size={18} />
                </span>
                <span className="al-t">
                  <b>Há mais de um mês sem extratos novos</b>O último é de {short(lastStatement)}.
                </span>
                <ChevronRight size={18} className="muted" />
              </button>
            )}
          </div>
        )}

        <section className="card">
          <div className="card-head">
            <h2 style={{ textTransform: 'capitalize' }}>{monthLabel(month)}</h2>
            <button className="link" onClick={() => go('insights')}>
              Resumo <ChevronRight size={16} />
            </button>
          </div>
          {totalSt && (
            <div className="stack" style={{ gap: 6, marginBottom: 14 }}>
              <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  <b className="num">{fmt(s.spent)}</b> <span className="muted">de {fmt(budgetTotal)}</span>
                </span>
                <span className="muted num">{Math.round(totalSt.pct * 100)}%</span>
              </div>
              <Bar value={totalSt.pct} state={totalSt.state} pace={totalSt.elapsed} />
            </div>
          )}
          <dl className="glance" style={{ margin: 0 }}>
            <div>
              <dt>Gastaste</dt>
              <dd className="num">{fmt(s.spent)}</dd>
            </div>
            <div>
              <dt>Entrou</dt>
              <dd className="num" style={{ color: 'var(--good)' }}>
                {fmt(s.income)}
              </dd>
            </div>
            <div>
              <dt>Poupaste</dt>
              <dd className="num">{fmt(s.toPots + s.toInvest)}</dd>
            </div>
          </dl>
        </section>

        <button className="card alert" style={{ padding: 16 }} onClick={onFood}>
          <span className="ic" style={{ background: 'color-mix(in srgb, var(--s4) 18%, transparent)', color: 'var(--s4)' }}>
            <Utensils size={18} />
          </span>
          <span className="al-t">
            <span className="small muted">Comida fora do cartão refeição</span>
            <b className="num" style={{ fontSize: 20 }}>
              {fmt(s.food)}
            </b>
            <span className="small muted">
              {s.food === 0 ? 'Objetivo: 0 €. Estás lá.' : `Objetivo: 0 € · mês anterior ${fmt(prev.food)}`}
            </span>
          </span>
          <ChevronRight size={18} className="muted" />
        </button>

        <div className="quick">
          <button onClick={() => go('import')}>
            <span className="qi">
              <ArrowDownToLine size={19} />
            </span>
            Importar
          </button>
          <button onClick={onTriage} disabled={!uncat}>
            <span className="qi">
              <Tags size={19} />
            </span>
            Categorizar
          </button>
          <button onClick={() => go('insights')}>
            <span className="qi">
              <Target size={19} />
            </span>
            Orçamentos
          </button>
        </div>

        <section className="card" style={{ paddingBottom: 6 }}>
          <div className="card-head" style={{ marginBottom: 2 }}>
            <h2>Últimos movimentos</h2>
            <button className="link" onClick={() => go('movements')}>
              Ver todos <ChevronRight size={16} />
            </button>
          </div>
          {recent.map((t) => (
            <TxRow key={t.id} t={t} onClick={() => onOpen(t)} />
          ))}
        </section>
      </div>
    </>
  );
}
