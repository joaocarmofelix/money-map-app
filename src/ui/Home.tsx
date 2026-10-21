import { useMemo, useState } from 'react';
import { needsCategory } from '../lib/tags';
import { FileUp, ArrowLeftRight, FlaskConical, HandCoins, ChevronRight, Flame, AlertTriangle, Tags, Target, FileWarning, Upload } from 'lucide-react';
import type { Goal, Settings, Tx } from '../lib/types';
import { accountBalances, accountList, budgetStatus, monthStats, netWorth, unpairedOwnTransfers } from '../lib/stats';
import { MONTHS, fmt, shiftMonth, today } from '../lib/text';
import { TxRow, useCats, usePeople } from './kit';
import { debtsWith } from '../lib/tags';
import { GoalEditor, GoalRow, useGoals } from './Goals';
import { useCompanion, type BudgetPulse } from './Companion';
import { inDemo, setDemoSpace } from '../lib/db';
import { AccountsGrid } from './AccountsGrid';
import { Arranged, OrganizeLink } from './PageLayout';

const DATE_FMT = new Intl.DateTimeFormat('pt-PT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

export type HomeTarget = 'insights' | 'movements' | 'import' | 'setup' | 'accounts' | 'goals' | 'backup' | 'people';

export function Home({
  txs,
  settings,
  month,
  go,
  onOpen,
  onTriage,
  onOwn,
  onAdd,
}: {
  txs: Tx[];
  settings: Settings;
  month: string;
  go: (where: HomeTarget) => void;
  onOpen: (t: Tx) => void;
  onTriage: () => void;
  onOwn: () => void;
  onAdd: () => void;
}) {
  const cx = useCats();
  const s = useMemo(() => monthStats(txs, month, cx), [txs, month, cx]);
  const accounts = useMemo(() => accountList(txs, settings), [txs, settings]);
  const visible = useMemo(() => {
    const order = settings.accountOrder ?? [];
    const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
    return accounts
      .filter((a) => !settings.hiddenAccounts.includes(a.key) && !a.key.endsWith('_unassigned'))
      .map((a, i) => ({ a, i }))
      .sort((x, y) => rank(x.a.key) - rank(y.a.key) || x.i - y.i)
      .map((x) => x.a);
  }, [accounts, settings.hiddenAccounts, settings.accountOrder]);
  const goals = useGoals(txs, settings);
  const [goalEdit, setGoalEdit] = useState<Goal | 'new' | null>(null);
  const recent = useMemo(() => [...txs].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)).slice(0, 5), [txs]);
  const uncat = txs.filter(needsCategory).length;
  const unpaired = useMemo(() => unpairedOwnTransfers(txs), [txs]);
  const mismatched = accounts.filter((a) => a.mismatch);
  const people = usePeople();
  const owed = useMemo(() => {
    let sum = 0;
    let n = 0;
    for (const id of people.keys()) {
      const d = debtsWith(txs, id).net;
      if (d > 0) {
        sum += d;
        n++;
      }
    }
    return { sum, n };
  }, [txs, people]);
  // What the companion knows about budgets: this calendar month so far and how last month ended.
  const pulse = useMemo<BudgetPulse | undefined>(() => {
    const budgeted = cx.roots.filter((r) => r.budget && !r.income && !r.extraordinary);
    if (!budgeted.length) return undefined;
    const ym = today().slice(0, 7);
    const cur = monthStats(txs, ym, cx);
    const prevYm = shiftMonth(ym, -1);
    const hasPrev = txs.some((t) => (t.statsMonth ?? t.date.slice(0, 7)) === prevYm);
    const prev = hasPrev ? monthStats(txs, prevYm, cx) : null;
    return {
      now: budgeted.map((r) => {
        const st = budgetStatus(cur.byCat.get(r.id) ?? 0, r.budget!, ym, today());
        return {
          id: r.id,
          name: r.name,
          state: st.state,
          pct: st.pct,
          left: st.left,
        };
      }),
      prev: prev
        ? {
            ym: prevYm,
            label: MONTHS[Number(prevYm.slice(5)) - 1].replace(/^./, (c) => c.toUpperCase()),
            met: budgeted.filter((r) => (prev.byCat.get(r.id) ?? 0) <= r.budget!).length,
            total: budgeted.length,
          }
        : undefined,
    };
  }, [txs, cx]);
  const companion = useCompanion(settings, { backup: () => go('backup'), add: onAdd, budgets: () => go('insights') }, pulse);
  const first = settings.ownerNames[0]?.split(' ')[0];
  const name = first ? first[0] + first.slice(1).toLowerCase() : '';

  const total = netWorth(accounts);
  const sum = (g: string) => accounts.filter((a) => a.group === g).reduce((x, a) => x + a.balance, 0);

  const budgetAlerts =
    settings.companion === false
      ? cx.roots
          .filter((r) => r.budget)
          .map((r) => ({
            r,
            st: budgetStatus(s.byCat.get(r.id) ?? 0, r.budget!, month, today()),
          }))
          .filter((x) => x.st.state !== 'ok')
          .sort((a, b) => b.st.pct - a.st.pct)
      : [];
  const balances = accountBalances(txs);
  const lastStatement = Object.values(balances).reduce((m, b) => (b.date > m ? b.date : m), '');
  const stale = lastStatement && Date.parse(today()) - Date.parse(lastStatement) > 35 * 86400000;

  const header = (
    <header className="appbar">
      <h1>
        {name ? `Olá, ${name}` : 'Olá'}
        <span className="sub">{cap(DATE_FMT.format(new Date()))}</span>
      </h1>
      <button className="icon-btn" onClick={() => go('import')} aria-label="Importar extrato" title="Importar extrato">
        <FileUp size={20} />
      </button>
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
            <button className="link" style={{ display: 'block', margin: '10px auto 0' }} onClick={() => setDemoSpace(true)}>
              Ou experimentar com dados de exemplo
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
        {inDemo ? (
          <div className="alert info demo-bar">
            <span className="ic">
              <FlaskConical size={18} />
            </span>
            <span className="al-t">
              <b>Modo de exemplo</b>Dados inventados. Os teus estão guardados à parte, intactos.
            </span>
            <button className="btn sm" onClick={() => setDemoSpace(false)}>
              Sair
            </button>
          </div>
        ) : (
          settings.demo && (
            <button className="alert info" onClick={() => go('backup')}>
              <span className="ic">
                <FlaskConical size={18} />
              </span>
              <span className="al-t">
                <b>Estás a ver dados de exemplo</b>Nada disto é real. Apaga-os em Mais › Dados e cópias quando quiseres começar.
              </span>
              <ChevronRight size={18} className="muted" />
            </button>
          )
        )}
        <section className={`hero${companion.mascot ? ' with-mascot' : ''}`} aria-label="Património total">
          {companion.mascot}
          {companion.bubble}
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

        <Arranged
          page="home"
          blocks={{
            accounts: <AccountsGrid accounts={visible} settings={settings} onManage={() => go('accounts')} />,
            goals: goals.length > 0 && (
              <section className="card" style={{ paddingBottom: 6 }}>
                <div className="card-head" style={{ marginBottom: 2 }}>
                  <h2>Objetivos</h2>
                  <button className="link" onClick={() => go('goals')}>
                    Ver todos <ChevronRight size={16} />
                  </button>
                </div>
                {goals.slice(0, 2).map(({ g, p }) => (
                  <GoalRow key={g.id} g={g} p={p} onClick={() => setGoalEdit(g)} />
                ))}
              </section>
            ),
            alerts: (budgetAlerts.length > 0 || uncat > 0 || stale || unpaired.length > 0 || mismatched.length > 0 || owed.sum > 0) && (
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
                      <b>
                        {uncat} {uncat === 1 ? 'movimento' : 'movimentos'} por categorizar
                      </b>
                      Vê a lista e escolhe os que já sabes.
                    </span>
                    <ChevronRight size={18} className="muted" />
                  </button>
                )}
                {mismatched.map((a) => (
                  <button key={a.key} className="alert warn" onClick={() => go('import')}>
                    <span className="ic">
                      <AlertTriangle size={18} />
                    </span>
                    <span className="al-t">
                      <b>
                        {a.name} não bate certo com o extrato ({fmt(a.mismatch!)})
                      </b>
                      Os movimentos não somam o saldo do último extrato. Pode faltar o extrato de algum mês.
                    </span>
                    <ChevronRight size={18} className="muted" />
                  </button>
                ))}
                {owed.sum > 0 && (
                  <button className="alert info" onClick={() => go('people')}>
                    <span className="ic">
                      <HandCoins size={18} />
                    </span>
                    <span className="al-t">
                      <b>Tens {fmt(owed.sum)} a receber</b>
                      {owed.n === 1 ? 'De 1 pessoa.' : `De ${owed.n} pessoas.`}
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
            ),
            recent: (
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
            ),
          }}
        />
        <OrganizeLink page="home" />
      </div>
      {goalEdit && <GoalEditor goal={goalEdit === 'new' ? undefined : goalEdit} txs={txs} settings={settings} onClose={() => setGoalEdit(null)} />}
    </>
  );
}
