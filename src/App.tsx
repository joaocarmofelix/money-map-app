import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Home as HomeIcon, List, Menu, PieChart, Plus } from 'lucide-react';
import { db, getSettings, loadDemo } from './lib/db';
import { shiftMonth, today } from './lib/text';
import type { Tx } from './lib/types';
import { CatsProvider, Toaster } from './ui/kit';
import { Home } from './ui/Home';
import { Insights } from './ui/Insights';
import { Movements, type Filter } from './ui/Movements';
import { ImportPage } from './ui/Import';
import { BackupPage, MORE_TITLES, MoreMenu, RulesPage, SetupPage, type MorePage } from './ui/More';
import { CategoriesPage } from './ui/Categories';
import { AccountsPage } from './ui/Accounts';
import { GoalsPage } from './ui/Goals';
import { QuickAdd } from './ui/QuickAdd';
import { EditTx } from './ui/EditTx';
import { Triage } from './ui/Triage';
import { OwnTransfersSheet } from './ui/OwnTransfers';
import { unpairedOwnTransfers } from './lib/stats';

type Tab = 'home' | 'insights' | 'movements' | 'more';

export default function App() {
  return (
    <CatsProvider>
      <Shell />
    </CatsProvider>
  );
}

function Shell() {
  const params = new URLSearchParams(location.search);
  const startTab = params.get('tab');
  const [tab, setTab] = useState<Tab>(startTab === 'importar' ? 'more' : 'home');
  const [page, setPage] = useState<MorePage | null>(startTab === 'importar' ? 'import' : null);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [userNav, setUserNav] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [cat, setCat] = useState<string | null>(null);
  const [adding, setAdding] = useState(params.get('add') === '1');
  const [editing, setEditing] = useState<Tx | null>(null);
  const [triage, setTriage] = useState<{ intro?: string } | null>(null);
  const [own, setOwn] = useState(false);

  const txs = useLiveQuery(() => db.txs.toArray(), []);
  const settings = useLiveQuery(getSettings, []);

  useEffect(() => {
    if (params.toString()) history.replaceState(null, '', location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The preview inside Claude starts with example data so there is something to look at.
  const seeding = useRef(false);
  useEffect(() => {
    if (import.meta.env.MODE !== 'artifact' || !txs || txs.length > 0 || seeding.current) return;
    seeding.current = true;
    // Check the stored state directly: the two live queries can update a moment apart.
    (async () => {
      const s = await getSettings();
      if (!s.demoDismissed && (await db.txs.count()) === 0) await loadDemo(today());
      seeding.current = false;
    })();
  }, [txs]);

  // Follow the latest month with data until you pick a month yourself.
  useEffect(() => {
    if (userNav || !txs?.length) return;
    const latest = txs.reduce((m, t) => (t.date > m ? t.date : m), '').slice(0, 7);
    if (latest && latest <= today().slice(0, 7)) setMonth(latest);
  }, [txs, userNav]);

  const nav = (d: number) => {
    setUserNav(true);
    setMonth((m) => shiftMonth(m, d));
  };
  const pickMonth = (ym: string) => {
    setUserNav(true);
    setMonth(ym);
  };
  const go = (t: Tab, p: MorePage | null = null) => {
    setTab(t);
    setPage(p);
    window.scrollTo(0, 0);
  };
  const showCategory = (id: string) => {
    setCat(id);
    setFilter('all');
    go('movements');
  };
  const closeTriage = useCallback(() => setTriage(null), []);

  if (!txs || !settings) return null;

  const tabBtn = (id: Tab, label: string, Icon: typeof HomeIcon) => (
    <button aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
      <span className="ti">
        <Icon size={21} strokeWidth={tab === id ? 2.4 : 2} />
      </span>
      {label}
    </button>
  );

  return (
    <div className="app">
      <main>
        {tab === 'home' && (
          <Home
            txs={txs}
            settings={settings}
            month={month}
            go={(w) => (w === 'insights' || w === 'movements' ? go(w) : go('more', w))}
            onOpen={setEditing}
            onTriage={() => setTriage({})}
            onOwn={() => setOwn(true)}
          />
        )}
        {tab === 'insights' && <Insights txs={txs} month={month} setMonth={pickMonth} nav={nav} onCategory={showCategory} />}
        {tab === 'movements' && (
          <Movements txs={txs} month={month} nav={nav} filter={filter} setFilter={setFilter} cat={cat} setCat={setCat} onOpen={setEditing} />
        )}
        {tab === 'more' && !page && <MoreMenu open={(p) => go('more', p)} />}
        {tab === 'more' && page && (
          <>
            <header className="appbar">
              <button className="icon-btn" onClick={() => go('more')} aria-label="Voltar">
                <ArrowLeft size={20} />
              </button>
              <h1 style={{ fontSize: 20 }}>{MORE_TITLES[page]}</h1>
            </header>
            {page === 'import' && <ImportPage onTriage={(intro) => setTriage({ intro })} />}
            {page === 'categories' && <CategoriesPage />}
            {page === 'accounts' && <AccountsPage txs={txs} />}
            {page === 'goals' && <GoalsPage txs={txs} settings={settings} />}
            {page === 'setup' && <SetupPage />}
            {page === 'rules' && <RulesPage />}
            {page === 'backup' && <BackupPage />}
          </>
        )}
      </main>

      <nav className="tabs" aria-label="Secções">
        <div className="tabs-in">
          {tabBtn('home', 'Início', HomeIcon)}
          {tabBtn('insights', 'Resumo', PieChart)}
          <button className="add" onClick={() => setAdding(true)} aria-label="Adicionar movimento">
            <Plus size={28} strokeWidth={2.5} />
          </button>
          {tabBtn('movements', 'Movimentos', List)}
          {tabBtn('more', 'Mais', Menu)}
        </div>
      </nav>

      {adding && <QuickAdd onClose={() => setAdding(false)} />}
      {editing && <EditTx t={editing} history={txs} onClose={() => setEditing(null)} />}
      {triage && (
        <Triage
          txs={txs}
          intro={triage.intro}
          onClose={closeTriage}
          onShowLater={() => {
            setTriage(null);
            setCat(null);
            setFilter('uncat');
            go('movements');
          }}
        />
      )}
      {own && <OwnTransfersSheet list={unpairedOwnTransfers(txs)} onClose={() => setOwn(false)} />}
      <Toaster />
    </div>
  );
}
