import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Home as HomeIcon, List, Menu, PieChart, Plus } from 'lucide-react';
import { db, getSettings, inDemo, loadDemo, refreshOpen, updateSettings } from './lib/db';
import { askNotifications, isNative, onOpenTarget, syncReminders, updateWidget } from './lib/native';
import { shiftMonth, today } from './lib/text';
import type { Tx } from './lib/types';
import { needsCategory } from './lib/tags';
import { CatsProvider, Toaster, setAppBack, useCats } from './ui/kit';
import { Home } from './ui/Home';
import { Insights } from './ui/Insights';
import { Movements, type Filter } from './ui/Movements';
import { ImportPage } from './ui/Import';
import { AppearancePage, BackupPage, MORE_TITLES, MoreMenu, RulesPage, SetupPage, type MorePage } from './ui/More';
import { CategoriesPage } from './ui/Categories';
import { AccountsPage } from './ui/Accounts';
import { GoalsPage } from './ui/Goals';
import { PeoplePage } from './ui/People';
import { QuickAdd } from './ui/QuickAdd';
import { EditTx } from './ui/EditTx';
import { Triage } from './ui/Triage';
import { BgWaves } from './ui/BgWaves';
import { Splash } from './ui/Splash';
import { applyTheme } from './lib/theme';
import { OwnTransfersSheet } from './ui/OwnTransfers';
import { applySalaryShift, monthStats, unpairedOwnTransfers } from './lib/stats';

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
  const [filter, setFilter] = useState<Filter>('all');
  const [cats, setCats] = useState<string[]>([]);
  const [adding, setAdding] = useState(params.get('add') === '1');
  const [editing, setEditing] = useState<Tx | null>(null);
  const [triage, setTriage] = useState<{ intro?: string } | null>(null);
  const [own, setOwn] = useState(false);
  const [splash, setSplash] = useState(true);

  const rawTxs = useLiveQuery(() => db.txs.toArray(), []);
  const settings = useLiveQuery(getSettings, []);
  const cx = useCats();
  useEffect(() => {
    if (settings) applyTheme(settings.theme);
  }, [settings?.theme]); // eslint-disable-line react-hooks/exhaustive-deps
  // Reports may count end-of-month salary in the next month (option in Perfil).
  const txs = useMemo(() => (rawTxs && settings ? applySalaryShift(rawTxs, settings, cx) : rawTxs), [rawTxs, settings, cx]);

  useEffect(() => {
    // Fix movements an older version left uncategorised (e.g. apparte withdrawals).
    refreshOpen().catch(() => {});
    if (params.toString()) history.replaceState(null, '', location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The preview inside Claude, and the example-data space, start with example data.
  const seeding = useRef(false);
  useEffect(() => {
    if ((import.meta.env.MODE !== 'artifact' && !inDemo) || !txs || txs.length > 0 || seeding.current) return;
    seeding.current = true;
    // Check the stored state directly: the two live queries can update a moment apart.
    (async () => {
      const s = await getSettings();
      if ((inDemo || !s.demoDismissed) && (await db.txs.count()) === 0) await loadDemo(today());
      seeding.current = false;
    })();
  }, [txs]);

  // The app always opens on the present month. If it was left open in the background and the
  // month changed meanwhile, coming back jumps to the new month too.
  useEffect(() => {
    let seen = today().slice(0, 7);
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      const now = today().slice(0, 7);
      if (now !== seen) {
        seen = now;
        setMonth(now);
      }
    };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, []);

  const nav = (d: number) => {
    setMonth((m) => shiftMonth(m, d));
  };
  const pickMonth = (ym: string) => {
    setMonth(ym);
  };
  const go = (t: Tab, p: MorePage | null = null) => {
    // Leaving home or opening a sub-page adds a step the Android back button can undo.
    if (p || (t !== 'home' && tab === 'home')) history.pushState({ nav: true }, '');
    setTab(t);
    setPage(p);
    window.scrollTo(0, 0);
  };
  // Widget taps and notification taps open the right screen.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(
    () =>
      onOpenTarget((t) => {
        if (t === 'add') setAdding(true);
        else if (t === 'backup') goRef.current('more', 'backup');
        else if (t === 'insights') goRef.current('insights');
        else goRef.current('home');
      }),
    [],
  );

  // Android app: ask once for permission to send the Pin's reminders.
  useEffect(() => {
    if (!settings || !isNative() || inDemo || settings.notifAsked || settings.notifications === false) return;
    (async () => {
      await askNotifications();
      await updateSettings({ notifAsked: true });
    })();
  }, [settings]);

  // Android app: keep the widget and the scheduled reminders in step with the data.
  useEffect(() => {
    if (!rawTxs || !settings || !isNative() || inDemo) return;
    const t = setTimeout(() => {
      const ym = today().slice(0, 7);
      const st = monthStats(rawTxs, ym, cx);
      const budgeted = cx.list.filter((c) => c.budget && !c.extraordinary && !cx.isIncome(c.id) && !cx.isExtra(c.id) && (!c.parentId || !cx.byId.get(c.parentId)?.budget));
      updateWidget({
        ym,
        spent: st.spent,
        budget: budgeted.reduce((a, c) => a + c.budget!, 0),
        budgetSpent: budgeted.reduce((a, c) => a + (st.byCat.get(c.id) ?? 0), 0),
      });
      syncReminders({ settings });
    }, 1200);
    return () => clearTimeout(t);
  }, [rawTxs, settings, cx]);

  const where = useRef({ tab, page });
  where.current = { tab, page };
  useEffect(() => {
    setAppBack(() => {
      const { tab: t, page: p } = where.current;
      if (p) setPage(null);
      else if (t !== 'home') setTab('home');
      window.scrollTo(0, 0);
    });
    return () => {
      setAppBack(null);
    };
  }, []);
  const showCategory = (id: string) => {
    setCats([id]);
    setFilter('all');
    go('movements');
  };
  const closeTriage = useCallback(() => setTriage(null), []);

  // Same position in both branches, so the opening animation keeps running while data loads.
  const opening = splash ? <Splash settings={settings} onDone={() => setSplash(false)} /> : null;
  if (!txs || !settings) return <>{opening}</>;

  const uncat = txs.filter(needsCategory).length;
  const tabBtn = (id: Tab, label: string, Icon: typeof HomeIcon, badge = 0) => (
    <button aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)} aria-label={badge ? `${label}, ${badge} por categorizar` : undefined}>
      <span className="ti">
        <Icon size={21} strokeWidth={tab === id ? 2.4 : 2} />
        {badge > 0 && <span className="tab-badge">{badge > 99 ? '99+' : badge}</span>}
      </span>
      {label}
    </button>
  );

  return (
    <>
    {opening}
    <div className="app">
      <div className="status-bg" aria-hidden />
      <BgWaves />
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
            onAdd={() => setAdding(true)}
          />
        )}
        {tab === 'insights' && <Insights txs={txs} month={month} setMonth={pickMonth} nav={nav} onCategory={showCategory} />}
        {tab === 'movements' && (
          <Movements txs={txs} month={month} nav={nav} filter={filter} setFilter={setFilter} cats={cats} setCats={setCats} onOpen={setEditing} />
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
            {page === 'people' && <PeoplePage txs={txs} />}
            {page === 'setup' && <SetupPage />}
            {page === 'look' && <AppearancePage />}
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
          {tabBtn('movements', 'Movimentos', List, uncat)}
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
        />
      )}
      {own && <OwnTransfersSheet list={unpairedOwnTransfers(txs)} onClose={() => setOwn(false)} />}
      <Toaster />
    </div>
    </>
  );
}
