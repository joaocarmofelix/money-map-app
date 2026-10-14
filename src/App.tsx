import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings } from './lib/db';
import { monthLabel, shiftMonth, today } from './lib/text';
import type { Tx } from './lib/types';
import { Summary } from './ui/Summary';
import { Movements, type Filter } from './ui/Movements';
import { Import } from './ui/Import';
import { More } from './ui/More';
import { QuickAdd } from './ui/QuickAdd';
import { EditTx } from './ui/EditTx';
import { Triage } from './ui/Triage';
import { Toaster } from './ui/shared';

type Tab = 'resumo' | 'movimentos' | 'importar' | 'mais';

export default function App() {
  const params = new URLSearchParams(location.search);
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'resumo');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(params.get('add') === '1');
  const [editing, setEditing] = useState<Tx | null>(null);
  const [triage, setTriage] = useState(false);

  const txs = useLiveQuery(() => db.txs.toArray(), []);
  const settings = useLiveQuery(getSettings, []);

  // Follow the latest month with data until you pick a month yourself.
  const [userNav, setUserNav] = useState(false);
  useEffect(() => {
    if (userNav || !txs?.length) return;
    const latest = txs.reduce((m, t) => (t.date > m ? t.date : m), '').slice(0, 7);
    if (latest && latest <= today().slice(0, 7)) setMonth(latest);
  }, [txs, userNav]);
  const nav = (delta: number) => {
    setUserNav(true);
    setMonth((m) => shiftMonth(m, delta));
  };

  useEffect(() => {
    if (params.get('add')) history.replaceState(null, '', location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeTriage = useCallback(() => setTriage(false), []);
  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo(0, 0);
  };

  if (!txs || !settings) return null;
  const showMonth = tab === 'resumo' || tab === 'movimentos';
  const nowMonth = today().slice(0, 7);

  return (
    <div className="app">
      {showMonth ? (
        <header className="month">
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="Mês anterior">
            ‹
          </button>
          <h1>{monthLabel(month)}</h1>
          <button className="icon-btn" onClick={() => nav(1)} disabled={month >= nowMonth} aria-label="Mês seguinte">
            ›
          </button>
        </header>
      ) : (
        <div style={{ height: 8 }} />
      )}

      <main>
        {tab === 'resumo' && (
          <Summary
            txs={txs}
            month={month}
            settings={settings}
            onTriage={() => setTriage(true)}
            onImport={() => go('importar')}
            onFood={() => {
              setFilter('food');
              go('movimentos');
            }}
          />
        )}
        {tab === 'movimentos' && <Movements txs={txs} month={month} filter={filter} setFilter={setFilter} onOpen={setEditing} />}
        {tab === 'importar' && <Import onNeedName={() => go('mais')} onTriage={() => setTriage(true)} />}
        {tab === 'mais' && <More />}
      </main>

      <nav className="tabs" aria-label="Secções">
        <button aria-current={tab === 'resumo' ? 'page' : undefined} onClick={() => go('resumo')}>
          <span className="i" aria-hidden>◔</span>Resumo
        </button>
        <button aria-current={tab === 'movimentos' ? 'page' : undefined} onClick={() => go('movimentos')}>
          <span className="i" aria-hidden>≡</span>Movimentos
        </button>
        <button className="add" onClick={() => setAdding(true)} aria-label="Adicionar gasto">
          +
        </button>
        <button aria-current={tab === 'importar' ? 'page' : undefined} onClick={() => go('importar')}>
          <span className="i" aria-hidden>⇣</span>Importar
        </button>
        <button aria-current={tab === 'mais' ? 'page' : undefined} onClick={() => go('mais')}>
          <span className="i" aria-hidden>⋯</span>Mais
        </button>
      </nav>

      {adding && <QuickAdd onClose={() => setAdding(false)} />}
      {editing && <EditTx t={editing} onClose={() => setEditing(null)} />}
      {triage && <Triage txs={txs} onClose={closeTriage} />}
      <Toaster />
    </div>
  );
}
