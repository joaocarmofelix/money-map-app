import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, knownPots, updateSettings } from '../lib/db';
import { INVESTMENTS } from '../lib/categories';
import { accountList } from '../lib/stats';
import type { Settings, Tx } from '../lib/types';
import { fmt } from '../lib/text';
import { IconTile, toast } from './kit';

const num = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Every account with its home-screen switch, plus starting balances for appartes and investments. */
export function AccountsPage({ txs }: { txs: Tx[] }) {
  const [s, setS] = useState<Settings | null>(null);
  const pots = useLiveQuery(knownPots, []) ?? [];
  useEffect(() => {
    getSettings().then(setS);
  }, []);
  const accounts = useMemo(() => (s ? accountList(txs, s) : []), [txs, s]);
  if (!s) return null;
  const startLabel = s.trackFrom ? s.trackFrom.split('-').reverse().join('/') : 'o primeiro extrato';

  const toggle = async (key: string, show: boolean) => {
    const hidden = new Set(s.hiddenAccounts);
    if (show) hidden.delete(key);
    else hidden.add(key);
    setS({ ...s, hiddenAccounts: [...hidden] }); // update the switch right away
    setS(await updateSettings({ hiddenAccounts: [...hidden] }));
  };
  const setStart = async (field: 'potStart' | 'investStart', key: string, v: string) => {
    const fresh = await getSettings();
    const map = { ...fresh[field] };
    const n = num(v);
    if (n === undefined) delete map[key];
    else map[key] = n;
    setS(await updateSettings({ [field]: map }));
    toast('Saldo inicial guardado');
  };

  return (
    <div className="stack">
      <section className="card" style={{ paddingBlock: 6 }}>
        <p className="small muted" style={{ margin: '6px 0' }}>
          Escolhe as contas que aparecem no ecrã inicial.
        </p>
        {accounts.length === 0 && <p className="muted">As contas aparecem depois de importares o primeiro extrato.</p>}
        {accounts.map((a) => (
          <div key={a.key} className="cat-row">
            <IconTile icon={a.icon} color={a.color} />
            <span>
              <b>{a.name}</b>
              <small className="num">
                {fmt(a.balance)} · {a.sub}
              </small>
            </span>
            {!a.key.endsWith('_unassigned') && (
              <input type="checkbox" className="toggle" checked={!s.hiddenAccounts.includes(a.key)} onChange={(e) => toggle(a.key, e.target.checked)} aria-label={`Mostrar ${a.name} no início`} />
            )}
          </div>
        ))}
      </section>

      {pots.length > 0 && (
        <section className="card stack">
          <div>
            <b>Appartes em {startLabel}</b>
            <p className="small muted" style={{ margin: '2px 0 0' }}>
              O extrato só mostra o total dos appartes. Indica quanto tinha cada um nessa data; daí em diante a app soma as transferências.
            </p>
          </div>
          {pots.map((p) => (
            <div className="field" key={p}>
              <label htmlFor={`pot-${p}`}>{p}</label>
              <input id={`pot-${p}`} inputMode="decimal" defaultValue={s.potStart[p] ?? ''} placeholder="0,00" onBlur={(e) => setStart('potStart', p, e.target.value)} />
            </div>
          ))}
        </section>
      )}

      <section className="card stack">
        <b>Investimentos</b>
        {INVESTMENTS.map((i) => (
          <div className="field" key={i.id}>
            <label htmlFor={`inv-${i.id}`}>
              {i.name}: já investido antes de {startLabel}
            </label>
            <input id={`inv-${i.id}`} inputMode="decimal" defaultValue={s.investStart[i.id] ?? ''} placeholder="0,00" onBlur={(e) => setStart('investStart', i.id, e.target.value)} />
            <span className="hint">Transferências com “Trading 212” na descrição contam como investimento, não como gasto.</span>
          </div>
        ))}
      </section>
    </div>
  );
}
