import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportBackup, getSettings, knownPots, restoreBackup, saveSettings } from '../lib/db';
import { catById, INVESTMENTS } from '../lib/categories';
import { isOwnTransfer } from '../lib/classify';
import { toast } from './shared';
import type { Settings } from '../lib/types';

export function More() {
  const [s, setS] = useState<Settings | null>(null);
  const [names, setNames] = useState('');
  const pots = useLiveQuery(knownPots, []) ?? [];
  const rules = useLiveQuery(() => db.rules.orderBy('pattern').toArray(), []) ?? [];

  useEffect(() => {
    getSettings().then((x) => {
      setS(x);
      setNames(x.ownerNames.join(', '));
    });
  }, []);
  if (!s) return null;

  async function saveNames() {
    const ownerNames = names.split(',').map((n) => n.trim().toUpperCase()).filter(Boolean);
    const next = { ...s!, ownerNames };
    await saveSettings(next);
    setS(next);
    // Re-mark existing movements that are transfers to yourself.
    const all = await db.txs.filter((t) => t.kind !== 'transfer' && isOwnTransfer(t.description, ownerNames)).toArray();
    await Promise.all(all.map((t) => db.txs.update(t.id!, { kind: 'transfer', categoryId: undefined })));
    toast(all.length ? `Guardado. ${all.length} movimentos passaram a transferências.` : 'Guardado');
  }

  async function setPot(pot: string, v: string) {
    const n = parseFloat(v.replace(',', '.'));
    const potStart = { ...s!.potStart };
    if (Number.isFinite(n)) potStart[pot] = n;
    else delete potStart[pot];
    const next = { ...s!, potStart };
    await saveSettings(next);
    setS(next);
  }

  async function saveStart(date: string) {
    const next = { ...s!, trackFrom: date };
    await saveSettings(next);
    setS(next);
    if (!date) return;
    const old = await db.txs.where('date').below(date).primaryKeys();
    await db.txs.bulkDelete(old);
    toast(old.length ? `Guardado. Saíram ${old.length} movimentos anteriores.` : 'Guardado');
  }

  async function setInvest(id: string, v: string) {
    const n = parseFloat(v.replace(',', '.'));
    const investStart = { ...s!.investStart };
    if (Number.isFinite(n)) investStart[id] = n;
    else delete investStart[id];
    const next = { ...s!, investStart };
    await saveSettings(next);
    setS(next);
  }

  const startLabel = s.trackFrom ? s.trackFrom.split('-').reverse().join('/') : 'o início';

  async function backup() {
    const blob = new Blob([await exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gastos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function restore(f?: File) {
    if (!f) return;
    try {
      await restoreBackup(await f.text());
      toast('Cópia reposta');
      location.reload();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <>
      <h2>O teu nome nos bancos</h2>
      <p className="muted">Transferências com este nome contam como movimentos entre as tuas contas. Separa variantes com vírgulas.</p>
      <div className="field">
        <input id="names" value={names} onChange={(e) => setNames(e.target.value)} placeholder="Ex.: JOAO SILVA" aria-label="O teu nome nos bancos" />
      </div>
      <button className="btn" onClick={saveNames}>
        Guardar nome
      </button>

      <h2>Começar a contar em</h2>
      <p className="muted">Movimentos anteriores a esta data ficam de fora. Os saldos das contas vêm dos extratos, por isso o dinheiro que já lá tinhas continua a contar.</p>
      <div className="field">
        <input type="date" value={s.trackFrom} onChange={(e) => saveStart(e.target.value)} aria-label="Data de início" />
      </div>

      <h2>Investimentos</h2>
      {INVESTMENTS.map((i) => (
        <div className="field" key={i.id}>
          <label htmlFor={`inv-${i.id}`}>
            {i.name}: já investido antes de {startLabel}
          </label>
          <input id={`inv-${i.id}`} inputMode="decimal" defaultValue={s.investStart[i.id] ?? ''} onBlur={(e) => setInvest(i.id, e.target.value)} placeholder="0,00" />
        </div>
      ))}
      <p className="muted">Transferências com “Trading 212” na descrição contam como investimento, não como gasto. Se alguma não for reconhecida, abre-a em Movimentos e marca-a.</p>

      {pots.length > 0 && (
        <>
          <h2>Appartes em {startLabel}</h2>
          <p className="muted">O extrato só mostra o total dos appartes. Indica quanto tinha cada um nessa data.</p>
          {pots.map((p) => (
            <div className="field" key={p}>
              <label htmlFor={`pot-${p}`}>{p}</label>
              <input id={`pot-${p}`} inputMode="decimal" defaultValue={s.potStart[p] ?? ''} onBlur={(e) => setPot(p, e.target.value)} placeholder="0,00" />
            </div>
          ))}
        </>
      )}

      <h2>Regras aprendidas</h2>
      {rules.length === 0 ? (
        <p className="muted">Ainda nenhuma. Aparecem aqui quando categorizas movimentos.</p>
      ) : (
        <ul className="list-plain">
          {rules.map((r) => {
            const c = catById(r.categoryId);
            return (
              <li key={r.id}>
                <span>
                  {r.pattern} <span className="muted">→ {c ? `${c.emoji} ${c.name}` : r.categoryId}</span>
                </span>
                <button className="link" onClick={() => db.rules.delete(r.id!)} aria-label={`Apagar regra ${r.pattern}`}>
                  Apagar
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <h2>Cópia de segurança</h2>
      <p className="muted">Os dados ficam só neste telemóvel. Guarda uma cópia de vez em quando (por exemplo no Google Drive).</p>
      <div className="row">
        <button className="btn" onClick={backup}>
          Guardar cópia
        </button>
        <label className="btn ghost" style={{ textAlign: 'center' }}>
          Repor cópia
          <input type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
        </label>
      </div>
    </>
  );
}
