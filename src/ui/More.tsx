import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, DatabaseBackup, FileUp, Sparkles, Tags, UserCog, Trash2 } from 'lucide-react';
import { db, exportBackup, getSettings, knownPots, restoreBackup, updateSettings } from '../lib/db';
import { INVESTMENTS } from '../lib/categories';
import { isOwnTransfer } from '../lib/classify';
import type { Settings } from '../lib/types';
import { CatIcon, toast, useCats } from './kit';

export type MorePage = 'import' | 'categories' | 'setup' | 'rules' | 'backup';
export const MORE_TITLES: Record<MorePage, string> = {
  import: 'Importar extratos',
  categories: 'Categorias e orçamentos',
  setup: 'Conta e saldos iniciais',
  rules: 'Regras aprendidas',
  backup: 'Cópia de segurança',
};

export function MoreMenu({ open }: { open: (p: MorePage) => void }) {
  const rules = useLiveQuery(() => db.rules.count(), []) ?? 0;
  const items: { id: MorePage; icon: typeof Tags; sub: string }[] = [
    { id: 'import', icon: FileUp, sub: 'PDF do Millennium, Excel do Bankinter' },
    { id: 'categories', icon: Tags, sub: 'Subcategorias, cores e limites mensais' },
    { id: 'setup', icon: UserCog, sub: 'Nome, data de início, Trading 212, appartes' },
    { id: 'rules', icon: Sparkles, sub: `${rules} ${rules === 1 ? 'regra' : 'regras'}` },
    { id: 'backup', icon: DatabaseBackup, sub: 'Guardar ou repor os teus dados' },
  ];
  return (
    <>
      <header className="appbar">
        <h1>Mais</h1>
      </header>
      <section className="card menu" style={{ padding: '4px 0' }}>
        {items.map(({ id, icon: Icon, sub }) => (
          <button key={id} onClick={() => open(id)}>
            <span className="mi">
              <Icon size={19} />
            </span>
            <span>
              <b>{MORE_TITLES[id]}</b>
              <small>{sub}</small>
            </span>
            <ChevronRight size={18} className="chev" />
          </button>
        ))}
      </section>
      <p className="small muted" style={{ textAlign: 'center', marginTop: 18 }}>
        MoneyMap · os teus dados ficam só neste dispositivo
      </p>
    </>
  );
}

export function SetupPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [names, setNames] = useState('');
  const pots = useLiveQuery(knownPots, []) ?? [];
  useEffect(() => {
    getSettings().then((x) => {
      setS(x);
      setNames(x.ownerNames.join(', '));
    });
  }, []);
  if (!s) return null;

  const update = async (patch: Partial<Settings>) => {
    const next = await updateSettings(patch);
    setS(next);
    return next;
  };
  const num = (v: string) => {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  };
  const startLabel = s.trackFrom ? s.trackFrom.split('-').reverse().join('/') : 'o início';

  async function saveNames() {
    const ownerNames = names.split(',').map((n) => n.trim().toUpperCase()).filter(Boolean);
    await update({ ownerNames });
    const all = await db.txs.filter((t) => t.kind !== 'transfer' && isOwnTransfer(t.description, ownerNames)).toArray();
    await Promise.all(all.map((t) => db.txs.update(t.id!, { kind: 'transfer', categoryId: undefined })));
    toast(all.length ? `Guardado. ${all.length} movimentos passaram a transferências.` : 'Nome guardado');
  }

  async function saveStart(date: string) {
    await update({ trackFrom: date });
    if (!date) return;
    const old = await db.txs.where('date').below(date).primaryKeys();
    await db.txs.bulkDelete(old);
    toast(old.length ? `Guardado. Saíram ${old.length} movimentos anteriores.` : 'Data de início guardada');
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="field">
          <label htmlFor="names">O teu nome nos bancos</label>
          <input id="names" value={names} onChange={(e) => setNames(e.target.value)} placeholder="Ex.: JOAO SILVA" />
          <span className="hint">Transferências com este nome contam como movimentos entre as tuas contas. Separa variantes com vírgulas.</span>
        </div>
        <button className="btn" onClick={saveNames}>
          Guardar nome
        </button>
      </section>

      <section className="card stack">
        <div className="field">
          <label htmlFor="start">Começar a contar em</label>
          <input id="start" type="date" value={s.trackFrom} onChange={(e) => saveStart(e.target.value)} />
          <span className="hint">Movimentos anteriores ficam de fora. Os saldos das contas vêm dos extratos, por isso o dinheiro que já lá tinhas continua a contar.</span>
        </div>
      </section>

      <section className="card stack">
        {INVESTMENTS.map((i) => (
          <div className="field" key={i.id}>
            <label htmlFor={`inv-${i.id}`}>
              {i.name}: já investido antes de {startLabel}
            </label>
            <input id={`inv-${i.id}`} inputMode="decimal" defaultValue={s.investStart[i.id] ?? ''} placeholder="0,00" onBlur={(e) => {
              const investStart = { ...s.investStart };
              const n = num(e.target.value);
              if (n === undefined) delete investStart[i.id];
              else investStart[i.id] = n;
              update({ investStart }).then(() => toast('Guardado'));
            }} />
            <span className="hint">Transferências com “Trading 212” na descrição contam como investimento, não como gasto.</span>
          </div>
        ))}
      </section>

      {pots.length > 0 && (
        <section className="card stack">
          <p className="small muted" style={{ margin: 0 }}>
            Saldo de cada apparte em {startLabel}. O extrato só mostra o total.
          </p>
          {pots.map((p) => (
            <div className="field" key={p}>
              <label htmlFor={`pot-${p}`}>{p}</label>
              <input id={`pot-${p}`} inputMode="decimal" defaultValue={s.potStart[p] ?? ''} placeholder="0,00" onBlur={(e) => {
                const potStart = { ...s.potStart };
                const n = num(e.target.value);
                if (n === undefined) delete potStart[p];
                else potStart[p] = n;
                update({ potStart });
              }} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export function RulesPage() {
  const rules = useLiveQuery(() => db.rules.orderBy('pattern').toArray(), []) ?? [];
  const cx = useCats();
  if (!rules.length) {
    return <p className="empty muted">Ainda não há regras. Aparecem quando categorizas movimentos com “usar esta categoria em todos”.</p>;
  }
  return (
    <section className="card" style={{ paddingBlock: 4 }}>
      {rules.map((r) => (
        <div key={r.id} className="cat-row">
          <CatIcon id={r.categoryId} size="sm" />
          <span>
            <b>{r.pattern}</b>
            <small>{cx.label(r.categoryId)}</small>
          </span>
          <button className="icon-btn" style={{ boxShadow: 'none' }} onClick={() => db.rules.delete(r.id!)} aria-label={`Apagar regra ${r.pattern}`}>
            <Trash2 size={17} />
          </button>
        </div>
      ))}
    </section>
  );
}

export function BackupPage() {
  async function backup() {
    const blob = new Blob([await exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `moneymap-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function restore(f?: File) {
    if (!f) return;
    try {
      await restoreBackup(await f.text());
      toast('Cópia reposta');
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <section className="card stack">
      <p className="muted" style={{ margin: 0 }}>
        Os dados ficam só neste telemóvel. Guarda uma cópia de vez em quando, por exemplo no Google Drive.
      </p>
      <button className="btn" onClick={backup}>
        Guardar cópia
      </button>
      <label className="btn ghost">
        Repor cópia
        <input type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
      </label>
    </section>
  );
}
