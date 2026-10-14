import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, DatabaseBackup, FileUp, Sparkles, Tags, Target, UserCog, Trash2, Users, Wallet } from 'lucide-react';
import { clearAll, db, exportBackup, getSettings, loadDemo, restoreBackup, updateSettings } from '../lib/db';
import { today } from '../lib/text';
import { isOwnTransfer } from '../lib/classify';
import type { Settings } from '../lib/types';
import { CatIcon, toast, useCats } from './kit';

export type MorePage = 'import' | 'accounts' | 'goals' | 'categories' | 'people' | 'setup' | 'rules' | 'backup';
export const MORE_TITLES: Record<MorePage, string> = {
  import: 'Importar extratos',
  accounts: 'Contas',
  goals: 'Objetivos',
  categories: 'Categorias e orçamentos',
  people: 'Pessoas',
  setup: 'Perfil e data de início',
  rules: 'Regras aprendidas',
  backup: 'Dados e cópias',
};

export function MoreMenu({ open }: { open: (p: MorePage) => void }) {
  const rules = useLiveQuery(() => db.rules.count(), []) ?? 0;
  const items: { id: MorePage; icon: typeof Tags; sub: string }[] = [
    { id: 'import', icon: FileUp, sub: 'PDF do Millennium, Excel do Bankinter' },
    { id: 'accounts', icon: Wallet, sub: 'Appartes, Trading 212 e o que aparece no início' },
    { id: 'goals', icon: Target, sub: 'Juntar um valor, poupar todos os meses' },
    { id: 'categories', icon: Tags, sub: 'Ativar, criar e definir orçamentos' },
    { id: 'people', icon: Users, sub: 'Família e amigos: quanto enviaste, recebeste e porquê' },
    { id: 'setup', icon: UserCog, sub: 'O teu nome nos bancos e quando começar a contar' },
    { id: 'rules', icon: Sparkles, sub: `${rules} ${rules === 1 ? 'regra' : 'regras'}` },
    { id: 'backup', icon: DatabaseBackup, sub: 'Cópia de segurança, dados de exemplo, apagar tudo' },
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
  const [confirm, setConfirm] = useState<'demo' | 'clear' | null>(null);
  async function run(what: 'demo' | 'clear') {
    if (what === 'demo') await loadDemo(today());
    else await clearAll();
    toast(what === 'demo' ? 'Dados de exemplo carregados' : 'Dados apagados');
    setTimeout(() => location.reload(), 500);
  }
  return (
    <div className="stack">
    <section className="card stack">
      <b>Cópia de segurança</b>
      <p className="muted" style={{ margin: 0 }}>
        Os dados ficam só neste dispositivo. Guarda uma cópia de vez em quando, por exemplo no Google Drive. A cópia leva tudo: movimentos, categorias, regras, orçamentos, objetivos e definições.
      </p>
      <button className="btn" onClick={backup}>
        Guardar cópia
      </button>
      <label className="btn ghost">
        Repor cópia
        <input type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
      </label>
    </section>
    <section className="card stack">
      <b>Experimentar a app</b>
      <p className="muted" style={{ margin: 0 }}>
        Seis meses de movimentos inventados, com appartes, Trading 212, orçamentos e objetivos. Substitui tudo o que tens agora.
      </p>
      {confirm === 'demo' ? (
        <button className="btn" onClick={() => run('demo')}>Confirmar: substituir pelos dados de exemplo</button>
      ) : (
        <button className="btn ghost" onClick={() => setConfirm('demo')}>Carregar dados de exemplo</button>
      )}
    </section>
    <section className="card stack">
      <b>Começar do zero</b>
      <p className="muted" style={{ margin: 0 }}>Apaga movimentos, regras, objetivos e categorias personalizadas. Não dá para desfazer sem uma cópia.</p>
      {confirm === 'clear' ? (
        <button className="btn danger" onClick={() => run('clear')}>Confirmar: apagar tudo</button>
      ) : (
        <button className="btn danger" onClick={() => setConfirm('clear')}>Apagar todos os dados</button>
      )}
    </section>
    </div>
  );
}
