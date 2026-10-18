import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Mascot, PinCreator } from './Companion';
import { askNotifications, isNative, notificationsAllowed, saveFile, shareFile } from '../lib/native';
import { ChevronRight, DatabaseBackup, Palette, Download, Share2, Upload, FileUp, Sparkles, Tags, Target, UserCog, Trash2, Users, Wallet } from 'lucide-react';
import { clearAll, db, exportBackup, getSettings, inDemo, loadDemo, restoreBackup, setDemoSpace, updateSettings } from '../lib/db';
import { today } from '../lib/text';
import { isOwnTransfer } from '../lib/classify';
import type { Settings } from '../lib/types';
import { CatIcon, Picker, toast, useCats } from './kit';

export type MorePage = 'import' | 'accounts' | 'goals' | 'categories' | 'people' | 'setup' | 'look' | 'rules' | 'backup';
export const MORE_TITLES: Record<MorePage, string> = {
  import: 'Importar extratos',
  accounts: 'Contas',
  goals: 'Objetivos',
  categories: 'Categorias e orçamentos',
  people: 'Pessoas',
  setup: 'Perfil e data de início',
  look: 'Aspeto e Pin',
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
    { id: 'setup', icon: UserCog, sub: 'Nome nos bancos, data de início e salário' },
    { id: 'look', icon: Palette, sub: 'Modo claro ou escuro, o Pin e os lembretes' },
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
        <div className="toggle-row">
          <span>
            <b>O salário do fim do mês conta para o mês seguinte</b>
            <span className="small muted" style={{ display: 'block' }}>
              Recebes no fim do mês e gastas no seguinte? Assim cada mês mostra o salário que realmente o pagou. Só muda os resumos e gráficos; os saldos seguem a data real.
            </span>
          </span>
          <input
            type="checkbox"
            className="toggle"
            checked={!!s.salaryShiftDay}
            onChange={async (e) => {
              const on = e.target.checked;
              await update({ salaryShiftDay: on ? 25 : undefined });
              toast(on ? 'O salário do fim do mês passa a contar no mês seguinte' : 'O salário conta no mês em que entra');
            }}
            aria-label="Salário do fim do mês conta no mês seguinte"
          />
        </div>
        {!!s.salaryShiftDay && (
          <div className="field">
            <label htmlFor="shift-day">A partir do dia</label>
            <Picker id="shift-day" title="A partir do dia" value={s.salaryShiftDay} onChange={(v) => update({ salaryShiftDay: v })} options={Array.from({ length: 12 }, (_, i) => ({ value: 20 + i, label: `Dia ${20 + i}` }))} />
            <span className="hint">Salários recebidos neste dia ou depois contam no mês seguinte.</span>
          </div>
        )}
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

/** Light/dark look and the companion: on or off, how it looks, what it reminds you of. */
export function AppearancePage() {
  const [s, setS] = useState<Settings | null>(null);
  const [creator, setCreator] = useState(false);
  useEffect(() => {
    getSettings().then(setS);
  }, []);
  if (!s) return null;
  const update = async (patch: Partial<Settings>) => setS(await updateSettings(patch));

  return (
    <div className="stack">
      {creator && (
        <PinCreator
          look={s.pin}
          onClose={async () => {
            setCreator(false);
            setS(await getSettings());
          }}
        />
      )}
      <section className="card stack">
        <div>
          <b>Aspeto</b>
          <span className="small muted" style={{ display: 'block' }}>
            Automático segue o modo claro ou escuro do telemóvel.
          </span>
        </div>
        <div className="seg" role="group" aria-label="Aspeto">
          {(
            [
              ['auto', 'Automático'],
              ['light', 'Claro'],
              ['dark', 'Escuro'],
            ] as const
          ).map(([v, label]) => (
            <button key={v} aria-pressed={(s.theme ?? 'auto') === v} onClick={() => update({ theme: v })}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card stack">
        <div className="toggle-row">
          <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Mascot size={44} className="m-fixed" look={s.pin} />
            <span>
              <b>Pin, o teu companheiro</b>
              <span className="small muted" style={{ display: 'block' }}>
                Aparece no início e lembra-te de guardar cópias e de apontar os gastos.
              </span>
            </span>
          </span>
          <input type="checkbox" className="toggle" checked={s.companion !== false} onChange={(e) => update({ companion: e.target.checked })} aria-label="Mostrar o Pin" />
        </div>
        {s.companion !== false && (
          <>
            <button className="btn ghost" onClick={() => setCreator(true)}>
              <Sparkles size={18} /> Personalizar o Pin
            </button>
            {isNative() && (
              <div className="toggle-row">
                <span>
                  <b>Notificações no telemóvel</b>
                  <span className="small muted" style={{ display: 'block' }}>
                    Os lembretes do Pin chegam mesmo com a app fechada.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="toggle"
                  checked={s.notifications !== false}
                  onChange={async (e) => {
                    const on = e.target.checked;
                    if (on && !(await notificationsAllowed()) && !(await askNotifications())) {
                      toast('Ativa as notificações do MoneyMap nas definições do Android');
                    }
                    await update({ notifications: on });
                  }}
                  aria-label="Notificações no telemóvel"
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="r-manual">Lembrar de apontar gastos</label>
              <Picker id="r-manual" title="Lembrar de apontar gastos" value={s.remindManualDays ?? 3} onChange={(v) => update({ remindManualDays: v })} options={[{ value: 0, label: 'Nunca' }, ...[1, 2, 3, 5, 7].map((d) => ({ value: d, label: d === 1 ? '1 dia sem apontar nada' : `${d} dias sem apontar nada` }))]} />
            </div>
            <div className="field">
              <label htmlFor="r-backup">Lembrar de guardar uma cópia</label>
              <Picker id="r-backup" title="Lembrar de guardar uma cópia" value={s.remindBackupMonths ?? 6} onChange={(v) => update({ remindBackupMonths: v })} options={[{ value: 0, label: 'Nunca' }, ...[1, 3, 6].map((m) => ({ value: m, label: m === 1 ? 'Todos os meses' : `De ${m} em ${m} meses` }))]} />
            </div>
          </>
        )}
      </section>

    </div>
  );
}

// Android's share sheet only takes some file types; plain text is one, JSON isn't. The content is the same.
const backupName = () => `moneymap-copia-${new Date().toISOString().slice(0, 10)}.txt`;

function canShareFiles() {
  try {
    return !!navigator.canShare?.({ files: [new File(['x'], 'a.txt', { type: 'text/plain' })] });
  } catch {
    return false;
  }
}

export function BackupPage() {
  const shareable = useMemo(() => isNative() || canShareFiles(), []);
  const [busy, setBusy] = useState(false);
  async function backup(mode: 'share' | 'save') {
    setBusy(true);
    try {
      const json = await exportBackup();
      if (isNative()) {
        // In the Android app: real JSON file, through the phone's own share sheet or saved in Documents.
        const name = `moneymap-copia-${new Date().toISOString().slice(0, 10)}.json`;
        if (mode === 'share') await shareFile(name, json, 'Cópia do MoneyMap');
        else toast(`Guardada em ${await saveFile(name, json)}`);
        await updateSettings({ lastBackupAt: Date.now() });
        if (mode === 'share') toast('Cópia partilhada');
        return;
      }
      const file = new File([json], backupName(), { type: 'text/plain' });
      if (mode === 'share') {
        try {
          await navigator.share({ files: [file], title: 'Cópia do MoneyMap' });
        } catch (e) {
          if ((e as Error).name === 'AbortError') return; // closed the share sheet
          throw e;
        }
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      }
      await updateSettings({ lastBackupAt: Date.now() });
      toast(mode === 'share' ? 'Cópia partilhada' : 'Cópia guardada nas transferências');
    } catch (e) {
      toast(`Não foi possível: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
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
    toast(what === 'demo' ? 'Exemplo recomeçado' : 'Dados apagados');
    setTimeout(() => location.reload(), 500);
  }
  return (
    <div className="stack">
    {!inDemo && (
    <section className="card stack">
      <b>Cópia de segurança</b>
      <p className="muted" style={{ margin: 0 }}>
        Os dados ficam só neste dispositivo. Guarda uma cópia de vez em quando, por exemplo no WhatsApp ou no Google Drive. A cópia leva tudo: movimentos, categorias, regras, orçamentos, objetivos, definições e os extratos importados.
      </p>
      {shareable && (
        <button className="btn" disabled={busy} onClick={() => backup('share')}>
          <Share2 size={18} /> Partilhar cópia
        </button>
      )}
      <button className={shareable ? 'btn ghost' : 'btn'} disabled={busy} onClick={() => backup('save')}>
        <Download size={18} /> Guardar no dispositivo
      </button>
      <label className="btn ghost">
        <Upload size={18} /> Repor cópia
        <input type="file" accept="application/json,text/plain,.json,.txt" hidden onChange={(e) => restore(e.target.files?.[0])} />
      </label>
    </section>
    )}
    <section className="card stack">
      <b>{inDemo ? 'Estás no modo de exemplo' : 'Experimentar a app'}</b>
      <p className="muted" style={{ margin: 0 }}>
        {inDemo
          ? 'Tudo o que vês e mudas aqui fica num espaço à parte. Os teus dados reais não são tocados e voltas a eles quando saíres.'
          : 'Abre um espaço à parte com seis meses de movimentos inventados, appartes, Trading 212, orçamentos e objetivos. Os teus dados ficam intactos e voltas a eles quando saíres.'}
      </p>
      {inDemo ? (
        <>
          <button className="btn" onClick={() => setDemoSpace(false)}>
            Voltar aos meus dados
          </button>
          <button className="btn ghost" onClick={() => run('demo')}>
            Recomeçar o exemplo do zero
          </button>
        </>
      ) : (
        <button className="btn ghost" onClick={() => setDemoSpace(true)}>
          Abrir o modo de exemplo
        </button>
      )}
    </section>
    {!inDemo && (
    <section className="card stack">
      <b>Começar do zero</b>
      <p className="muted" style={{ margin: 0 }}>Apaga movimentos, regras, objetivos e categorias personalizadas. Não dá para desfazer sem uma cópia.</p>
      {confirm === 'clear' ? (
        <button className="btn danger" onClick={() => run('clear')}>Confirmar: apagar tudo</button>
      ) : (
        <button className="btn danger" onClick={() => setConfirm('clear')}>Apagar todos os dados</button>
      )}
    </section>
    )}
    </div>
  );
}
