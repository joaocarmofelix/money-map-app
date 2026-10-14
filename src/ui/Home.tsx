import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ChevronRight, Flame, AlertTriangle, Tags, Target, FileWarning, Upload, Plus, SlidersHorizontal } from 'lucide-react';
import type { Goal, Settings, Tx } from '../lib/types';
import { accountBalances, accountList, budgetStatus, monthStats, netWorth, unpairedOwnTransfers } from '../lib/stats';
import { fmt, monthLabel, today } from '../lib/text';
import { Bar, IconTile, TxRow, useCats } from './kit';
import { GoalEditor, GoalRow, useGoals } from './Goals';

const DATE_FMT = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

export type HomeTarget = 'insights' | 'movements' | 'import' | 'setup' | 'accounts' | 'goals';

export function Home({
  txs,
  settings,
  month,
  go,
  onOpen,
  onTriage,
  onOwn,
}: {
  txs: Tx[];
  settings: Settings;
  month: string;
  go: (where: HomeTarget) => void;
  onOpen: (t: Tx) => void;
  onTriage: () => void;
  onOwn: () => void;
}) {
  const cx = useCats();
  const s = useMemo(() => monthStats(txs, month, cx), [txs, month, cx]);
  const accounts = useMemo(() => accountList(txs, settings), [txs, settings]);
  const visible = accounts.filter((a) => !settings.hiddenAccounts.includes(a.key) && !a.key.endsWith('_unassigned'));
  const goals = useGoals(txs, settings);
  const [goalEdit, setGoalEdit] = useState<Goal | 'new' | null>(null);
  const recent = useMemo(() => [...txs].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)).slice(0, 5), [txs]);
  const uncat = txs.filter((t) => !t.categoryId && t.kind !== 'transfer').length;
  const unpaired = useMemo(() => unpairedOwnTransfers(txs), [txs]);
  const first = settings.ownerNames[0]?.split(' ')[0];
  const name = first ? first[0] + first.slice(1).toLowerCase() : '';

  const total = netWorth(accounts);
  const sum = (g: string) => accounts.filter((a) => a.group === g).reduce((x, a) => x + a.balance, 0);

  const budgetTotal = cx.roots.filter((r) => !r.income && !r.extraordinary).reduce((a, r) => a + (r.budget ?? 0), 0);
  const budgetAlerts = cx.roots
    .filter((r) => r.budget)
    .map((r) => ({ r, st: budgetStatus(s.byCat.get(r.id) ?? 0, r.budget!, month, today()) }))
    .filter((x) => x.st.state !== 'ok')
    .sort((a, b) => b.st.pct - a.st.pct);
  const balances = accountBalances(txs);
  const lastStatement = Object.values(balances).reduce((m, b) => (b.date > m ? b.date : m), '');
  const stale = lastStatement && Date.parse(today()) - Date.parse(lastStatement) > 35 * 86400000;
  const totalSt = budgetTotal > 0 ? budgetStatus(s.spent, budgetTotal, month, today()) : null;

  const header = (
    <header className="appbar">
      <h1>
        {name ? `Olá, ${name}` : 'Olá'}
        <span className="sub">{cap(DATE_FMT.format(new Date()))}</span>
      </h1>
    </header>
  );

  if (!txs.length) {
    return (
      <>
        {header}
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
                <b>Configura a app primeiro</b>O teu nome nos bancos e a data a partir da qual queres contar.
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
      {header}
      <div className="stack">
        <section className="hero" aria-label="Património total">
          <div className="label">Património total</div>
          <div className="big num">{fmt(total)}</div>
          <div className="split num">
            <span>
              Contas<b>{fmt(sum('bank'))}</b>
            </span>
            <span>
              Appartes<b>{fmt(sum('pot'))}</b>
            </span>
            {accounts.some((a) => a.group === 'invest') && (
              <span>
                Investido<b>{fmt(sum('invest'))}</b>
              </span>
            )}
          </div>
        </section>

        <div className="accounts" role="list" aria-label="Contas">
          {visible.map((a) => (
            <div className="acc" role="listitem" key={a.key}>
              <div className="top">
                <IconTile icon={a.icon} color={a.color} size="sm" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
              </div>
              <div className="val num">{fmt(a.balance)}</div>
              <div className="when">{a.sub}</div>
            </div>
          ))}
          <button className="acc acc-edit" onClick={() => go('accounts')}>
            <SlidersHorizontal size={18} />
            Escolher contas
          </button>
        </div>

        {(budgetAlerts.length > 0 || uncat > 0 || stale || unpaired.length > 0) && (
          <div className="stack" style={{ gap: 8 }}>
            {budgetAlerts.slice(0, 2).map(({ r, st }) => (
              <button key={r.id} className={`alert ${st.state}`} onClick={() => go('insights')}>
                <span className="ic">{st.state === 'over' ? <Flame size={18} /> : <AlertTriangle size={18} />}</span>
                <span className="al-t">
                  <b>
                    {r.name}: {st.state === 'over' ? 'orçamento ultrapassado' : 'perto do limite'}
                  </b>
                  {st.state === 'over'
                    ? `Passaste ${fmt(-st.left)} do limite. Hora de apertar o cinto.`
                    : `Restam ${fmt(st.left)} de ${fmt(r.budget!)}${st.projected > r.budget! ? `; ao ritmo atual chegas a ${fmt(st.projected)}` : ''}.`}
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
            {unpaired.length > 0 && (
              <button className="alert warn" onClick={onOwn}>
                <span className="ic">
                  <ArrowLeftRight size={18} />
                </span>
                <span className="al-t">
                  <b>
                    {unpaired.length} {unpaired.length === 1 ? 'transferência para ti sem par' : 'transferências para ti sem par'}
                  </b>
                  Diz se foram para uma conta que a app não acompanha.
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
            <h2>{cap(monthLabel(month))}</h2>
            <button className="link" onClick={() => go('insights')}>
              Orçamentos <ChevronRight size={16} />
            </button>
          </div>
          {totalSt ? (
            <div className="stack" style={{ gap: 6, marginBottom: 14 }}>
              <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  <b className="num">{fmt(s.spent)}</b> <span className="muted">de {fmt(budgetTotal)} orçamentados</span>
                </span>
                <span className="muted num">{Math.round(totalSt.pct * 100)}%</span>
              </div>
              <Bar value={totalSt.pct} state={totalSt.state} pace={totalSt.elapsed} />
            </div>
          ) : (
            <button className="link" style={{ marginBottom: 10 }} onClick={() => go('insights')}>
              <Plus size={16} /> Definir orçamento mensal
            </button>
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
          {s.extra > 0 && (
            <p className="small muted" style={{ margin: '10px 0 0' }}>
              Mais <b className="num">{fmt(s.extra)}</b> em despesas extraordinárias ({s.extraByRoot.map((x) => cx.byId.get(x.id)?.name).join(', ')}).
            </p>
          )}
        </section>

        <section className="card" style={{ paddingBottom: goals.length ? 6 : 16 }}>
          <div className="card-head" style={{ marginBottom: goals.length ? 2 : 8 }}>
            <h2>Objetivos</h2>
            <button className="link" onClick={() => (goals.length ? go('goals') : setGoalEdit('new'))}>
              {goals.length ? (
                <>
                  Ver todos <ChevronRight size={16} />
                </>
              ) : (
                <>
                  <Plus size={16} /> Criar
                </>
              )}
            </button>
          </div>
          {goals.length === 0 && (
            <p className="small muted" style={{ margin: 0 }}>
              Define metas para te motivar, por exemplo juntar 10 000 € no apparte Stocks ou poupar 500 € por mês.
            </p>
          )}
          {goals.slice(0, 3).map(({ g, p }) => (
            <GoalRow key={g.id} g={g} p={p} onClick={() => setGoalEdit(g)} />
          ))}
        </section>

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
          <button onClick={() => go('goals')}>
            <span className="qi">
              <Target size={19} />
            </span>
            Objetivos
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
      {goalEdit && <GoalEditor goal={goalEdit === 'new' ? undefined : goalEdit} txs={txs} settings={settings} onClose={() => setGoalEdit(null)} />}
    </>
  );
}
